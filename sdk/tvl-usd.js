const debug = require("debug")("opentvl:tvl-usd");
const abi = require("./abis/aggregatorV3.json");
const sdk = require(".");
const fetch = require("node-fetch");
const { getPriceFeeds } = require("./lib/chainlink");
const { applyDecimals } = require("./lib/big-number");
const BigNumber = require("bignumber.js");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const DECIMALS_ABI = abi[0];
const LATEST_ROUND_DATA_ABI = abi[3];

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
    case "UNI-V2":
      return "UNI";
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
  const decimalsData = (
    await api.abi.multiCall({
      abi: DECIMALS_ABI,
      calls: tokens.map(({ symbol }) => ({ target: protocolFeeds[symbol].contract })),
    })
  ).output;

  const priceData = (
    await api.abi.multiCall({
      abi: LATEST_ROUND_DATA_ABI,
      calls: tokens.map(({ symbol }) => ({ target: protocolFeeds[symbol].contract })),
    })
  ).output;

  return tokens.map(({ symbol, count }, idx) => {
    let currentToken = symbol;
    let currentValue = BigNumber(count);

    while (currentToken !== "USD") {
      const { target: targetToken } = protocolFeeds[currentToken];

      const decimals = BigNumber(decimalsData[idx].output);
      const { answer } = priceData[idx].output;
      currentValue = currentValue.times(applyDecimals(answer, decimals));
      currentToken = targetToken;
    }

    return { symbol, tvl: currentValue, price: currentValue / count, count };
  });
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

    return { symbol, tvl: price ? count * price : 0, price, count };
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

  const ethTokenPrices = await convertToUSD(ethTokens, feeds.eth, sdk.eth);
  const bscTokenPrices = await convertToUSD(bscTokens, feeds.bsc, sdk.bsc);
  const hecoTokenPrices = await convertToUSD(hecoTokens, feeds.heco, sdk.heco);
  const coinGeckoPrices = await fetchCoinGeckoPrices(coinGeckoTokens);

  debug("ethTokenPrices", ethTokens, ethTokenPrices);
  debug("bscTokenPrices", bscTokens, bscTokenPrices);
  debug("hecoTokenPrices", hecoTokens, hecoTokenPrices);
  debug("coinGeckoPrices", coinGeckoTokens, coinGeckoPrices);

  const tvl = [...ethTokenPrices, ...bscTokenPrices, ...hecoTokenPrices, ...coinGeckoPrices].reduce(
    (sum, { tvl }) => sum.plus(tvl),
    BigNumber(0)
  );

  return tvl.toString();
}

module.exports = computeTVLUSD;
