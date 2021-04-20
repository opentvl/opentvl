const debug = require("debug")("opentvl:tvl-usd");
const abi = require('./abis/aggregatorV3.json')
const sdk = require('.');
const fetch = require('node-fetch');
const { getPriceFeeds } = require('./lib/chainlink');
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const BSC_TOKENS = require('./data/bscTokenLists.json');
const ETH_TOKENS = require('./data/ethTokenLists.json');

let feeds = {};
getPriceFeeds().then(res => {
  debug("finished fetching price feed proxy addresses");
  feeds = res;
});

function normalizeSymbol(symbol) {
  const formatted = symbol.toUpperCase();
  switch (formatted) {
    case 'WBNB':
    case 'BNB':
      return 'BNB';
    case 'WETH':
    case 'ETH':
      return 'ETH';
    case 'WBTC':
    case 'BTC':
      return 'BTC';
    case 'HDOT':
    case 'DOT':
      return 'DOT';
    default:
      return formatted;
  }
}

function partitionTokens(tokenCounts) {
  return Object.entries(tokenCounts).reduce((acc, [symbol, count]) => {
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
  }, { ethTokens: [], bscTokens: [], hecoTokens: [], coinGeckoTokens: []})
}

async function convertToUSD(tokens, protocolFeeds, api) {
  return await Promise.all(
    tokens.map(async ({ symbol, count }) => {
      let currentToken = symbol;
      let currentValue = count;
      
      while (currentToken !== 'USD') {
        const { target: targetToken, contract } = protocolFeeds[currentToken];
        const { output: decimals } = await api.abi.call({ target: contract, abi: abi[0], block: undefined, params: []});
        const { output } = await api.abi.call({ target: contract, abi: abi[3], block: undefined, params: []});
        const { answer } = output;
        currentValue *= (answer / (10 ** decimals));
        currentToken = targetToken;
      }

      return { symbol, tvl: currentValue, price: currentValue / count, count };
    })
  );
}

async function fetchCoinGeckoPrices(coinGeckoTokens) {
  const numGroups = Math.ceil(coinGeckoTokens.length / 250);
  const tokenGroups = coinGeckoTokens.reduce((acc, token, i) => {
    // Put ids in alternating slots to create equal size groups
    const index = i % numGroups;
    acc[index].push(token);
    return acc;
  }, [...Array(numGroups)].map(x => []));

  return (await Promise.all(
    tokenGroups.map(async (group, i) => {
      await wait(600 * i);
      const ids = group.map(({ id }) => id).join(",");

      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      const priceJSON = await priceRes.json();

      return Object.keys(priceJSON).map(targetID => {
        const { symbol, count } = group.find(({ id }) => id === targetID);
        const price = priceJSON[targetID].usd;

        return { symbol, tvl: count * price, price, count};
      }, []);
    })
  ))
    // Combine results into one object
    .flat();
}

// We want to iterate over all of the tokens in our tokenCounts,
// find their corresponding proxy addresses, make the call to chainlink to get
// the price, and then multiply the price by the token counts and sum all the
// products together to get tvl in USD
async function computeTVLUSD(tokenCounts) {
  const { ethTokens, bscTokens, hecoTokens, coinGeckoTokens } = partitionTokens(tokenCounts);

  debug("I get here")

  const ethTokenPrices = await convertToUSD(ethTokens, feeds.eth, sdk.eth);
  const bscTokenPrices = await convertToUSD(bscTokens, feeds.bsc, sdk.bsc);
  //const hecoTokenPrices = await convertToUSD(hecoTokens, feeds.heco, sdk.heco);
  const coinGeckoPrices = await fetchCoinGeckoPrices(coinGeckoTokens);

  console.log("BSC", bscTokens)
  console.log("COUNTS", tokenCounts)
  console.log("ETH", ethTokenPrices)

  const tvl = [...ethTokenPrices, ...bscTokenPrices, ...coinGeckoPrices]
    .reduce((sum, { tvl }) => sum + tvl, 0);

  return tvl;
}

/*function computeTVLUSD(tokenCounts) {
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
}*/

module.exports = computeTVLUSD;