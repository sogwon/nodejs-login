const cloudbaseSDK = require("@cloudbase/node-sdk");
require("dotenv").config();

const cloudbase = cloudbaseSDK.init({
  env: process.env.CLOUDBASE_ENV_ID,
  secretId: process.env.CLOUDBASE_SECRET_ID || process.env.CLOUDBASE_SECRETID,
  secretKey: process.env.CLOUDBASE_SECRET_KEY || process.env.CLOUDBASE_SECRETKEY,
});

module.exports = { cloudbase };
