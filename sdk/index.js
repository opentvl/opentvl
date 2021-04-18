require("dotenv").config();

const bscApi = require("./bsc-api");
const ethApi = require("./eth-api");
const util = require("./util");

module.exports = {
  bsc: bscApi,
  eth: ethApi,
  // keep compatibility for old adapters
  api: ethApi,
  util: util
};
