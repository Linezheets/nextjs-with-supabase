const router = require('express').Router();
const db = require('../middleware/db');
const crypto = require('crypto');
const { authenticate, requireBrand, requireBuyer } = require('../middleware/auth');

// AES-256-GCM message encryption — keys derived from room ID + server secret
const CHAT_SECRET = process.env.CHAT_SECRET || 'change-this-secret-in-production';

function encryptMessage(text, roomId) {
  const key = crypto.scryptSync(CHAT_SECRET + roomId, 'salt', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptMessage(enc, roomId) {
  try {
    const [ivHex, tagHex, dataHex] = enc.split(':');
    const key = crypto.scryptSync(CHAT_SECRET + roomId, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '[message unavailable]';
  }
}

function decryptRoom(messages, roomId) {
  return messages.map(m => ({ ...m, body: decryptMessage(m.body, roomId) }));
}

// ── GET /api/chat/rooms — list all chat rooms for current user ────────────────
router.get('/rooms', authenticate, async (req, res, next) => {
  try {
    let query;
    if (req.role === 'brand') {
      query = `
        SELECT cr.id, cr.created_at, cr.order_id,
               buy.company_name AS other_name, u2.email AS other_email,
               (SELECT COUNT(*) FROM chat_messages cm WHERE cm.room_id = cr.id AND cm.read_at IS NULL AND cm.sender_id != $2) AS unread,
               (SELECT cm2.body FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_enc,
               (SELECT cm2.created_at FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_at
        FROM chat_rooms cr
        JOIN brands b ON b.id = cr.brand_id
        JOIN buyers buy ON buy.id = cr.buyer_id
        JOIN users u2 ON u2.id = buy.user_id
        WHERE b.id = $1
        ORDER BY last_message_at DESC NULLS LAST`;
    } else {
      query = `
        SELECT cr.id, cr.created_at, cr.order_id,
               b.brand_name AS other_name, u2.email AS other_email,
               (SELECT COUNT(*) FROM chat_messages cm WHERE cm.room_id = cr.id AND cm.read_at IS NULL AND cm.sender_id != $2) AS unread,
               (SELECT cm2.body FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_enc,
               (SELECT cm2.created_at FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_at
        FROM chat_rooms cr
        JOIN buyers buy ON buy.id = cr.buyer_id
        JOIN brands b ON b.id = cr.brand_id
        JOIN users u2 ON u2.id = b.user_id
        WHERE buy.id = $1
        ORDER BY last_message_at DESC NULLS LAST`;
    }

    const profileId = req.role === 'brand' ? req.brandId : req.buyerId;
    const { rows } = await db.query(query, [profileId, req.userId]);

    // Decrypt last message for preview
    const rooms = rows.map(r => ({
      ...r,
      last_message: r.last_message_enc ? decryptMessage(r.last_message_enc, r.id).substring(0, 60) : null,
      last_message_enc: undefined,
    }));

    res.json({ rooms });
  } catch (err) { next(err); }
});

// ── POST /api/chat/rooms — open/find a room between brand and buyer ───────────
router.post('/rooms', authenticate, async (req, res, next) => {
  try {
    const { brandId, buyerId, orderId } = req.body;
    if (!brandId || !buyerId) return res.status(400).json({ error: 'brandId and buyerId required' });

    const { rows: [room] } = await db.query(
      `INSERT INTO chat_rooms (brand_id, buyer_id, order_id) VALUES ($1,$2,$3)
       ON CONFLICT (brand_id, buyer_id) DO UPDATE SET order_id = COALESCE(EXCLUDED.order_id, chat_rooms.order_id)
       RETURNING id`,
      [brandId, buyerId, orderId || null]
    );
    res.json({ roomId: room.id });
  } catch (err) { next(err); }
});

// ── GET /api/chat/rooms/:roomId/messages — fetch messages ────────────────────
router.get('/rooms/:roomId/messages', authenticate, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user has access to this room
    await assertRoomAccess(req, roomId);

    const params = [roomId, limit];
    let timeCond = '';
    if (before) { timeCond = ` AND cm.created_at < $3`; params.push(before); }

    const { rows } = await db.query(
      `SELECT cm.id, cm.room_id, cm.body, cm.read_at, cm.created_at,
              u.id AS sender_id, u.first_name, u.last_name, u.role
       FROM chat_messages cm JOIN users u ON u.id = cm.sender_id
       WHERE cm.room_id = $1 ${timeCond}
       ORDER BY cm.created_at DESC
       LIMIT $2`, params
    );

    // Mark unread as read
    await db.query(
      `UPDATE chat_messages SET read_at = NOW() WHERE room_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [roomId, req.userId]
    );

    res.json({ messages: decryptRoom(rows.reverse(), roomId) });
  } catch (err) { next(err); }
});

// ── POST /api/chat/rooms/:roomId/messages — send a message ───────────────────
router.post('/rooms/:roomId/messages', authenticate, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });

    await assertRoomAccess(req, roomId);

    const encrypted = encryptMessage(body.trim(), roomId);

    const { rows: [msg] } = await db.query(
      `INSERT INTO chat_messages (room_id, sender_id, body) VALUES ($1,$2,$3)
       RETURNING id, room_id, created_at`,
      [roomId, req.userId, encrypted]
    );

    res.status(201).json({ ...msg, body: body.trim() });
  } catch (err) { next(err); }
});

// ── GET /api/chat/rooms/:roomId/unread-count ──────────────────────────────────
router.get('/rooms/:roomId/unread', authenticate, async (req, res, next) => {
  try {
    await assertRoomAccess(req, req.params.roomId);
    const { rows: [r] } = await db.query(
      `SELECT COUNT(*) AS count FROM chat_messages
       WHERE room_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [req.params.roomId, req.userId]
    );
    res.json({ unread: parseInt(r.count) });
  } catch (err) { next(err); }
});

async function assertRoomAccess(req, roomId) {
  const { rows: [room] } = await db.query('SELECT * FROM chat_rooms WHERE id = $1', [roomId]);
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });

  if (req.role === 'brand') {
    const { rows: [b] } = await db.query('SELECT id FROM brands WHERE id = $1 AND user_id = $2', [room.brand_id, req.userId]);
    if (!b) throw Object.assign(new Error('Access denied'), { status: 403 });
  } else if (req.role === 'buyer') {
    const { rows: [b] } = await db.query('SELECT id FROM buyers WHERE id = $1 AND user_id = $2', [room.buyer_id, req.userId]);
    if (!b) throw Object.assign(new Error('Access denied'), { status: 403 });
  } else if (req.role !== 'admin') {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }
}

module.exports = router;
