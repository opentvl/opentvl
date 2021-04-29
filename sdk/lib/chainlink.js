const { applyDecimals } = require("./big-number");
const PRICE_ABIS = require("../abis/price.json");

const LATEST_ROUND_DATA_ABI = PRICE_ABIS.find(i => i.name === "latestRoundData");
const DECIMALS_ABI = PRICE_ABIS.find(i => i.name === "decimals");

function getSupportedTokens({ feedList }) {
  return Object.keys(feedList);
}

async function getPrices({ symbols, feedList, multiCall }) {
  const answersRes = (
    await multiCall({
      abi: LATEST_ROUND_DATA_ABI,
      calls: symbols.map(symbol => ({ target: feedList[symbol].contract }))
    })
  ).output;

  const decimalsRes = (
    await multiCall({
      abi: DECIMALS_ABI,
      calls: symbols.map(symbol => ({ target: feedList[symbol].contract }))
    })
  ).output;

  return answersRes.reduce((acc, a, idx) => {
    const d = decimalsRes[idx];
    if (a.success && d.success) {
      const symbol = symbols[idx];
      const decimals = d.output;
      acc[symbol] = applyDecimals(a.output.answer, decimals);
    }

    return acc;
  }, {});
}

async function getUSDPrice({ symbol, feedList, multiCall }) {
  if (feedList[symbol]) {
    const prices = await getPrices({ symbols: [symbol], feedList, multiCall });

    return prices[symbol];
  }

  return null;
}

module.exports = {
  getSupportedTokens,
  getUSDPrice
};
