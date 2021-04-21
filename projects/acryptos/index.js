const { tvl: vaultTvl } = require("./vault/");
const { tvl: stableSwapTvl } = require("./stableSwap");
const sdk = require("../../sdk");
const debug = require("debug")("opentvl:acryptos");

// acrytos is a fork of yearn + curve
async function tvl(timestamp, block) {
  // calculate tvl in stableswap (curve)
  // const stableSwapResult = await sdk.bsc.util.toSymbols(await stableSwapTvl(timestamp, block));
  // return stableSwapResult;
  // calculate tvl in vault (yearn)
  const vaultResult = await sdk.bsc.util.toSymbols(await vaultTvl(timestamp, block));
  debug(vaultResult);
  return vaultResult;
}

module.exports = {
  version: "2",
  name: "ACryptoS",
  token: "ACS",
  category: "assets",
  start: 3261994, // 02/12/2020 @ 12:00am (UTC)
  tvl,
};
