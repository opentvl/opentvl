const { tvl: vaultTvl } = require("./vault/");
const { tvl: stableSwapTvl } = require("./stableSwap");
const sdk = require("../../sdk");

// acrytos is a fork of yearn + curve
async function tvl(timestamp, block) {
  // calculate tvl in stableswap (curve)
  const stableSwapResult = await stableSwapTvl(timestamp, block);
  // calculate tvl in vault (yearn)
  const vaultResult = await vaultTvl(timestamp, block);

  return { bsc: sdk.util.sum([stableSwapResult, vaultResult]) };
}

module.exports = {
  version: "2",
  name: "ACryptoS",
  token: "ACS",
  category: "assets",
  start: 3261994, // 02/12/2020 @ 12:00am (UTC)
  tvl
};
