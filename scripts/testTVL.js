const sdk = require('../sdk');
const fetch = require('node-fetch');
const fs = require('fs');
const debug = require("debug")("open-tvl:test-tvl");

const COIN_IDS = require('./data/coinGeckoIDs.json')
const NEWEST_ETH_BLOCK = 12252663;
const NEWEST_BSC_BLOCK = 6602732;

async function testTVL(projectName, chain) {
  const { tvl } = require(`../projects/${projectName}`);

  const balances = chain === "eth" ? (
    await tvl(undefined, NEWEST_ETH_BLOCK)
  ) : (
    await tvl(undefined, NEWEST_BSC_BLOCK)
  )

  const result = chain === "eth" ? (
    await sdk.api.util.toSymbols(balances)
  ) : (
    await sdk.bsc.util.toSymbols(balances)
  );

  fs.writeFileSync('data/contractAddresses.json', JSON.stringify(Object.keys(result.output)));

  let ids = {};
  Object.keys(result.output).forEach(ticker => {
    const coin = COIN_IDS.find(t => ticker.toLowerCase() === t.symbol.toLowerCase());

    if (!coin) {
      debug("couldn't find coin:", ticker)
      return
    }

    const { id } = coin;

    if (id) {
      ids[ticker] = id;
    } else {
      console.log("unable to find corresponding id for:", ticker)
    }
  })


  let idQueryString = Object.entries(ids)
    .map(([ticker, id]) => id)
    .join(",");

  const pricesURL = `https://api.coingecko.com/api/v3/simple/price?ids=${idQueryString}&vs_currencies=usd`
  const pricesRes = await fetch(pricesURL)
  const prices = await pricesRes.json();

  const totalValueLocked = Object.entries(result.output)
    .reduce((acc, [ticker, tokens]) => {
      const id = ids[ticker];

      if (!id) {
        debug("bad id:", ticker)
        return acc;
      }

      const tokenPrice = prices[id];
      if (!tokenPrice) {
        debug("bad price:", ticker)
        return acc;
      }

      return acc + tokenPrice.usd * tokens;
    }, 0)

  const currencyFormat = {
    style: 'currency',
    currency: 'USD'
  }
  console.log("tvl:", totalValueLocked.toLocaleString(undefined, currencyFormat));
}

function main() {
  if (!process.argv[2]) {
    debug("Missing project name");
    return;
  }
  
  if (!process.argv[3]) {
    debug("Missing project type: please provide eth or bsc");
    return;
  }
  
  testTVL(process.argv[2], process.argv[3]);
}

main();
