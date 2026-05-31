const { IPinfoWrapper } = require("node-ipinfo");

// Initialize the IPinfo wrapper with your environment token

const ipinfo = new IPinfoWrapper(process.env.IPINFO_TOKEN);

// Export it or use it below...

module.exports = ipinfo;
