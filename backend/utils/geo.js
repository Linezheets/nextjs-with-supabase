const IPInfoWrapper = require("node-ipinfo");

// Initialize IPInfo using the factory function instead of a constructor
const ipinfo = IPInfoWrapper(process.env.IPINFO_TOKEN);

async function getGeoLocation(ip) {
    try {
        if (!ip || ip === '::1' || ip === '127.0.0.1') {
            return { country: 'US', region: 'California', city: 'Local' };
        }
        const data = await ipinfo.lookupIP(ip);
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

module.exports = { getGeoLocation };
