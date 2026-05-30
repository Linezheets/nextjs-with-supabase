// backend/utils/geo.js
const IPInfoWrapper = require("node-ipinfo");
require('dotenv').config(); 

// Pass the token directly into the default factory function
const ipinfo = IPInfoWrapper(process.env.IPINFO_TOKEN);
/**
 * Extracts and cleans the real client IP address, handling proxy chains securely.
 */
function getClientIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  // Remove IPv6-wrapped IPv4 prefixes if present
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip === '::1' ? '127.0.0.1' : ip;
}

/**
 * Resolves location telemetry from a target IP using ipinfo.
 */
async function getLocationFromIP(ip) {
  // Graceful fallback for local development testing
  if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
    return {
      country: 'Localhost',
      city: 'Local Machine',
      region: 'Internal Network',
      latitude: '0.0',
      longitude: '0.0'
    };
  }

  try {
    const response = await ipinfo.lookupIp(ip);
    
    let latitude = '0.0';
    let longitude = '0.0';
    if (response.loc) {
      const parts = response.loc.split(',');
      latitude = parts[0] || '0.0';
      longitude = parts[1] || '0.0';
    }

  return {
      country: response.country || 'Unknown',
      city: response.city || 'Unknown',
      region: response.region || 'Unknown',
      latitude,
      longitude
    };
  } catch (error) {
    console.error(`IPInfo resolution warning for IP (${ip}):`, error.message);
    return {
      country: 'Error Fetching',
      city: 'Error Fetching',
      region: 'Error Fetching',
      latitude: '0.0',
      longitude: '0.0'
    };
  }
}

module.exports = {
  getClientIp,
  getLocationFromIP
};
