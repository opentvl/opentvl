const fs = require('fs');
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

async function getFeedsForURL(url) {
  const html = await (await fetch(url)).text();

  const root = parse(html);
  const table = root.querySelector('table');
  const tableRows = table.querySelectorAll('tr');

  const feedAddresses = tableRows.reduce((acc, row) => {
    const [pair, decimals, proxy] = row.querySelectorAll('td').map(el => el.innerText);

    if (!pair) {
      return acc;
    }

    const [symbol, target] = pair.split(' / ');
    const formattedSymbol = symbol;
    if (!acc[formattedSymbol] || target === 'USD') {
      acc[formattedSymbol] = { target, decimals, contract: proxy };
    } 

    return acc;
  }, {});

  return feedAddresses;
}

async function getPriceFeeds() {
  const ETH_URL = 'https://docs.chain.link/docs/ethereum-addresses';
  const BSC_URL = 'https://docs.chain.link/docs/binance-smart-chain-addresses';
  const HECO_URL = 'https://docs.chain.link/docs/huobi-eco-chain-price-feeds';

  const ethFeeds = await getFeedsForURL(ETH_URL);
  const bscFeeds = await getFeedsForURL(BSC_URL);
  const hecoFeeds = await getFeedsForURL(HECO_URL);

  fs.writeFileSync("../sdk/data/ethChainlinkFeeds.json", JSON.stringify(ethFeeds, undefined, 2));
  fs.writeFileSync("../sdk/data/bscChainlinkFeeds.json", JSON.stringify(bscFeeds, undefined, 2));
  fs.writeFileSync("../sdk/data/hecoChainlinkFeeds.json", JSON.stringify(hecoFeeds, undefined, 2));
}

getPriceFeeds();