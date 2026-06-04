const { IPinfoWrapper } = require("node-ipinfo");

// Initialize the IPinfo wrapper with your environment token

const ipinfo = new IPinfoWrapper(process.env.IPINFO_TOKEN);

async function getGeoLocation(ip) {
  try {
    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      return { country: 'US', region: 'California', city: 'Local' };
    }
    const data = await ipinfo.lookupIp(ip);
    return {
      country: data.country || 'US',
      region: data.region || 'Unknown',
      city: data.city || 'Unknown'
    };
  } catch (error) {
    console.error('IPInfo lookup error:', error);
    return { country: 'US', region: 'Unknown', city: 'Unknown' };
  }
}

const getLocationFromIP = getGeoLocation;

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

module.exports = { getClientIp, getGeoLocation, getLocationFromIP };
