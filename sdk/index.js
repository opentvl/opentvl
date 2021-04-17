require("dotenv").config();

const bscApi = require("./bsc-api");
const ethApi = require("./api");
const util = require("./util");

module.exports = {
  bsc: bscApi,
  eth: ethApi,
  api: ethApi, // keep compatibility for old adapters
  util: util
};
