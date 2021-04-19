const debug = require("debug")("opentvl:tvl-usd");

const TOKEN_PRICES = require('./data/tokenPrices.json');

function computeTVLUSD(tokenCounts) {
  const tvlUSD = Object.entries(tokenCounts)
    .reduce((acc, [ticker, numTokens]) => {
      const key = ticker.toUpperCase();
      if (TOKEN_PRICES[key]) {
        return acc + numTokens * TOKEN_PRICES[key];
      } else {
        debug(`unable to find price for: ${ticker}`);
        return acc;
      }
    }, 0);

  return tvlUSD;
}

module.exports = computeTVLUSD;