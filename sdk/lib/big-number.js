const BigNumber = require("bignumber.js");

function applyDecimals(bigNumber, decimals) {
  return new BigNumber(output).dividedBy(new BigNumber(10).exponentiatedBy(new BigNumber(decimals))).toString();
}

module.exports = {
  applyDecimals
};
