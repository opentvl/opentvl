const debug = require("debug")("opentvl:tvl-usd");
const abi = require("./abis/aggregatorV3.json");
const sdk = require(".");
const fetch = require("node-fetch");
const { getPriceFeeds } = require("./lib/chainlink");
const { applyDecimals } = require("./lib/big-number");
const BigNumber = require("bignumber.js");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const COIN_GECKO_IDS = require("./data/coinGeckoIDs.json");

let feeds = {};
getPriceFeeds().then((res) => {
  debug("finished fetching price feed proxy addresses");
  feeds = res;
});

function normalizeSymbol(symbol) {
  const formatted = symbol.toUpperCase();
  switch (formatted) {
    case "WBNB":
    case "BNB":
      return "BNB";
    case "WETH":
    case "ETH":
      return "ETH";
    case "WBTC":
    case "BTC":
      return "BTC";
    case "HDOT":
    case "DOT":
      return "DOT";
    default:
      return formatted;
  }
}

function partitionTokens(tokenCounts) {
  return Object.entries(tokenCounts).reduce(
    (acc, [symbol, count]) => {
      // The tokens in tokenCounts are derived from the tokenSet
      // That token may be known by a different name in the feeds mapping
      // Thus we need to call a normalize function to convert the token to the
      // feeds naming system before we interact with the feeds
      const normalized = normalizeSymbol(symbol);
      const entry = { symbol: normalized, count };
      if (feeds.eth[normalized]) {
        acc.ethTokens.push(entry);
      } else if (feeds.bsc[normalized]) {
        acc.bscTokens.push(entry);
      } else if (feeds.heco[normalized]) {
        acc.hecoTokens.push(entry);
      } else {
        acc.coinGeckoTokens.push(entry);
      }

      return acc;
    },
    { ethTokens: [], bscTokens: [], hecoTokens: [], coinGeckoTokens: [] }
  );
}

async function convertToUSD(tokens, protocolFeeds, api) {
  return await Promise.all(
    tokens.map(async ({ symbol, count }) => {
      let currentToken = symbol;
      let currentValue = BigNumber(count);

      while (currentToken !== "USD") {
        const { target: targetToken, contract } = protocolFeeds[currentToken];
        const { output: decimals } = await api.abi.call({
          target: contract,
          abi: abi[0],
          block: undefined,
          params: [],
        });
        const { output } = await api.abi.call({ target: contract, abi: abi[3], block: undefined, params: [] });
        const { answer } = output;
        currentValue = currentValue.times(applyDecimals(answer, decimals));
        currentToken = targetToken;
      }

      return { symbol, tvl: currentValue, price: currentValue.div(count), count };
    })
  );
}

async function fetchGroupPrices(group) {
  const groupWithIDs = group.reduce((acc, { symbol, count }) => {
    const token = COIN_GECKO_IDS.find(({ symbol: other }) => symbol.toUpperCase() === other.toUpperCase());

    if (token?.id) {
      acc.push({ id: token.id, symbol, count });
    }
    return acc;
  }, []);

  const ids = groupWithIDs.map(({ id }) => id).join(",");

  const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  const priceJSON = await priceRes.json();

  return groupWithIDs.map(({ id, symbol, count }) => {
    const price = priceJSON[id].usd;

    return { symbol, tvl: count * price, price, count };
  });
}

async function fetchCoinGeckoPrices(coinGeckoTokens) {
  const numGroups = Math.ceil(coinGeckoTokens.length / 250);
  const tokenGroups = coinGeckoTokens.reduce(
    (acc, token, i) => {
      // Put ids in alternating slots to create equal size groups
      const index = i % numGroups;
      acc[index].push(token);
      return acc;
    },
    [...Array(numGroups)].map(() => [])
  );

  return (
    (
      await Promise.all(
        tokenGroups.map(async (group, i) => {
          await wait(600 * i);
          return await fetchGroupPrices(group);
        })
      )
    )
      // Combine results into one object
      .flat()
  );
}

// We want to iterate over all of the tokens in our tokenCounts,
// find their corresponding proxy addresses, make the call to chainlink to get
// the price, and then multiply the price by the token counts and sum all the
// products together to get tvl in USD
async function computeTVLUSD(tokenCounts) {
  const { ethTokens, bscTokens, hecoTokens, coinGeckoTokens } = partitionTokens(tokenCounts);
  debug("ethTokens", ethTokens);
  debug("bscTokens", bscTokens);
  debug("hecoTokens", hecoTokens);
  debug("coinGeckoTokens", coinGeckoTokens);

  const ethTokenPrices = await convertToUSD(ethTokens, feeds.eth, sdk.eth);
  const bscTokenPrices = await convertToUSD(bscTokens, feeds.bsc, sdk.bsc);
  const hecoTokenPrices = await convertToUSD(hecoTokens, feeds.heco, sdk.heco);
  const coinGeckoPrices = await fetchCoinGeckoPrices(coinGeckoTokens);
  debug("ethTokenPrices", ethTokenPrices);
  debug("bscTokenPrices", bscTokenPrices);
  debug("hecoTokenPrices", hecoTokenPrices);
  debug("coinGeckoPrices", coinGeckoPrices);

  const tvl = [...ethTokenPrices, ...bscTokenPrices, ...hecoTokenPrices, ...coinGeckoPrices].reduce(
    (sum, { tvl }) => sum.plus(tvl),
    BigNumber(0)
  );

  return tvl.toString();
}

module.exports = computeTVLUSD;
