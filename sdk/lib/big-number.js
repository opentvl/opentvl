const BigNumber = require("bignumber.js");

function applyDecimals(bigNumber, decimals) {
  const dividend = new BigNumber(10).exponentiatedBy(new BigNumber(decimals));

  return new BigNumber(bigNumber).dividedBy(dividend).toString();
}

module.exports = {
  applyDecimals
};
