const BigNumber = require("bignumber.js");
const sdk = require("./sdk");
const debug = require("debug")("opentvl:tvl-usd");

function normalizeSymbol(symbol) {
  const mapping = {
    WBNB: "BNB",
    WETH: "ETH",
    WBTC: "BTC",
    HDOT: "DOT",
    "UNI-V2": "UNI"
  };

  const formatted = symbol.toUpperCase();
  return mapping[formatted] ?? formatted;
}

function partitionTokens(tokenCounts) {
  const ethTokens = sdk.eth.chainlink.getSupportedTokens();
  const bscTokens = sdk.bsc.chainlink.getSupportedTokens();
  const hecoTokens = sdk.heco.chainlink.getSupportedTokens();

  return Object.entries(tokenCounts).reduce(
    (acc, [symbol, count]) => {
      // The tokens in tokenCounts are derived from the tokenSet
      // That token may be known by a different name in the feeds mapping
      // Thus we need to call a normalize function to convert the token to the
      // feeds naming system before we interact with the feeds
      const normalized = normalizeSymbol(symbol);
      const entry = { symbol: normalized, count };
      if (ethTokens.includes(normalized)) {
        acc.ethTokens.push(entry);
      } else if (bscTokens.includes(normalized)) {
        acc.bscTokens.push(entry);
      } else if (hecoTokens.includes(normalized)) {
        acc.hecoTokens.push(entry);
      }

      return acc;
    },
    { ethTokens: [], bscTokens: [], hecoTokens: [] }
  );
}

// We want to iterate over all of the tokens in our tokenCounts,
// find their corresponding proxy addresses, make the call to chainlink to get
// the price, and then multiply the price by the token counts and sum all the
// products together to get tvl in USD
async function computeTVLUSD(tokens) {
  const tokenCounts = sdk.util.sum(
    [
      tokens.eth && (await sdk.eth.util.toSymbols(tokens.eth)).output,
      tokens.bsc && (await sdk.bsc.util.toSymbols(tokens.bsc)).output,
      tokens.heco && (await sdk.heco.util.toSymbols(tokens.heco)).output
    ].filter(Boolean)
  );

  const { ethTokens, bscTokens, hecoTokens } = partitionTokens(tokenCounts);

  const ethTokenPrices = await sdk.eth.chainlink.getUSDPrices(ethTokens);
  const bscTokenPrices = await sdk.bsc.chainlink.getUSDPrices(bscTokens);
  const hecoTokenPrices = await sdk.heco.chainlink.getUSDPrices(hecoTokens);

  const prices = [...ethTokenPrices, ...bscTokenPrices, ...hecoTokenPrices];

  const tvl = prices.reduce((sum, { tvl }) => sum.plus(tvl), BigNumber(0));

  return tvl.toNumber();
}

module.exports = computeTVLUSD;
