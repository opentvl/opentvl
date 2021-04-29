const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const debug = require("debug")("opentvl:server:chainlink");

const CHAINS = [
  {
    file: "bscChainlinkFeeds.json",
    key: "bsc"
  },
  {
    file: "ethChainlinkFeeds.json",
    key: "eth"
  },
  {
    file: "hecoChainlinkFeeds.json",
    key: "heco"
  }
];

function mapFeeds(network) {
  debug(`found ${network.proxies.length} pairs for ${network.name}`);

  const feedAddresses = network.proxies.reduce((acc, row) => {
    const { pair, decimals, proxy } = row;

    if (!pair) {
      return acc;
    }

    const [symbol, target] = pair.split(" / ");

    if (!acc[symbol] || target === "USD") {
      acc[symbol] = { target, decimals, contract: proxy };
    }

    return acc;
  }, {});

  return feedAddresses;
}

async function getFeeds() {
  const feedsRes = await fetch("https://cl-docs-addresses.web.app/addresses.json");

  if (feedsRes.ok) {
    const feeds = await feedsRes.json();

    return {
      bsc: mapFeeds(feeds["binance-smart-chain-addresses-price"].networks[0]),
      eth: mapFeeds(feeds["ethereum-addresses"].networks[0]),
      heco: mapFeeds(feeds["huobi-eco-chain-price-feeds"].networks[0])
    };
  }

  // fallback to empty
  return {
    bsc: {},
    eth: {},
    heco: {}
  };
}

async function savePriceFeeds(directory) {
  const feeds = await getFeeds();

  for (let chain of CHAINS) {
    const chainFeeds = feeds[chain.key];
    const filePath = path.join(directory, chain.file);

    debug(`saved ${Object.keys(chainFeeds).length} feeds to ${filePath}`);

    fs.writeFileSync(filePath, JSON.stringify(chainFeeds, undefined, 2));
  }
}

module.exports = { savePriceFeeds };
