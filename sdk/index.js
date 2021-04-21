const bscApi = require("./bsc-api");
const ethApi = require("./eth-api");
const hecoApi = require("./heco-api");
const util = require("./util");

module.exports = {
  bsc: bscApi,
  eth: ethApi,
  // keep compatibility for old adapters
  heco: hecoApi,
  api: ethApi,
  util: util
};
