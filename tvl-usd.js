const BigNumber = require("bignumber.js");
const Bottleneck = require("bottleneck");
const sdk = require("./sdk");
const fetch = require("node-fetch");
const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 600 });
const debug = require("debug")("opentvl:tvl-usd");

const COIN_GECKO_IDS = require("./coinGeckoIDs.json");

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
      } else {
        acc.coinGeckoTokens.push(entry);
      }

      return acc;
    },
    { ethTokens: [], bscTokens: [], hecoTokens: [], coinGeckoTokens: [] }
  );
}

async function fetchGroupPrices(group) {
  const groupWithIDs = group.reduce((acc, { symbol, count }) => {
    const token = COIN_GECKO_IDS.find(({ symbol: other }) => symbol.toUpperCase() === other.toUpperCase());

    if (token?.id) {
      acc.push({ id: token.id, symbol, count });
    } else {
      debug(`unable to find coingecko id for ${symbol}`);
    }
    return acc;
  }, []);

  const ids = groupWithIDs.map(({ id }) => id).join(",");

  const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  const priceJSON = await priceRes.json();

  return groupWithIDs.map(({ id, symbol, count }) => {
    if (!priceJSON[id]?.usd) {
      debug("missing price information for", id, symbol);

      return { symbol, tvl: new BigNumber(0), price: new BigNumber(0), count };
    }

    const price = new BigNumber(priceJSON[id].usd);
    const tvl = price.multipliedBy(new BigNumber(count));

    return { symbol, tvl, price, count };
  });
}

const rateLimitedFetchGroupPrices = limiter.wrap(fetchGroupPrices);

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

  const prices = (await Promise.all(tokenGroups.map(async group => await rateLimitedFetchGroupPrices(group)))).flat();

  return prices;
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

  const { ethTokens, bscTokens, hecoTokens, coinGeckoTokens } = partitionTokens(tokenCounts);

  const ethTokenPrices = await sdk.eth.chainlink.getUSDPrices(ethTokens);
  const bscTokenPrices = await sdk.bsc.chainlink.getUSDPrices(bscTokens);
  const hecoTokenPrices = await sdk.heco.chainlink.getUSDPrices(hecoTokens);
  const coinGeckoPrices = await fetchCoinGeckoPrices(coinGeckoTokens);

  const prices = [...ethTokenPrices, ...bscTokenPrices, ...hecoTokenPrices, ...coinGeckoPrices];

  const tvl = prices.reduce((sum, { tvl }) => sum.plus(tvl), BigNumber(0));

  return tvl.toNumber();
}

module.exports = computeTVLUSD;
