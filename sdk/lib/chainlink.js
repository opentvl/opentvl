const LATEST_ROUND_DATA_ABI = require("../abis/latestRoundData.json");
const BigNumber = require("bignumber.js");
const { applyDecimals } = require("./big-number");

function getSupportedTokens({ feedList }) {
  return Object.keys(feedList);
}

async function getPrices({ symbols, feedList, multiCall }) {
  const prices = (
    await multiCall({
      abi: LATEST_ROUND_DATA_ABI,
      calls: symbols.map((symbol) => ({ target: feedList[symbol].contract })),
    })
  ).output;

  return prices.reduce((acc, res, idx) => {
    if (res.success) {
      const symbol = symbols[idx];
      const { decimals } = feedList[symbol];
      acc[symbol] = applyDecimals(res.output.answer, decimals);
    }

    return acc;
  }, {});
}

async function getUSDPrices({ tokens, feedList, multiCall }) {
  // Ensure that we have intermediary token prices, i.e CAKE -> BNB -> USD
  const tokenSymbols = tokens.reduce((acc, { symbol }) => {
    const { target } = feedList[symbol];

    acc.add(symbol);

    if (target !== "USD") {
      acc.add(target);
    }

    return acc;
  }, new Set());

  const prices = await getPrices({ symbols: [...tokenSymbols], feedList, multiCall });

  return tokens.map(({ symbol, count }) => {
    let currentToken = symbol;
    let currentValue = BigNumber(count);

    while (currentToken !== "USD") {
      const { target: targetToken } = feedList[currentToken];
      currentValue = currentValue.times(prices[currentToken]);
      currentToken = targetToken;
    }

    return { symbol, tvl: currentValue, price: currentValue.div(count), count };
  });
}

module.exports = {
  getSupportedTokens,
  getUSDPrices,
};
