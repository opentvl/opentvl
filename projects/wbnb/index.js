const sdk = require("../../sdk");
const BigNumber = require("bignumber.js");

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

async function tvl(_, block) {
  const totalSupply = (
    await sdk.bsc.abi.call({
      block,
      target: WBNB,
      abi: "bep20:totalSupply"
    })
  ).output;

  const balances = {};
  balances[WBNB] = new BigNumber(totalSupply).toFixed();

  return { bsc: balances };
}

module.exports = {
  version: "2",
  name: "Binance WBNB",
  token: "WBNB",
  category: "assets",
  start: 1599119584, // Sep-03-2020 07:53:04 AM +UTC
  tvl
};
