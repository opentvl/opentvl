const fs = require('fs');
const fetch = require('node-fetch');

const API_URL = 'https://api.coingecko.com/api/v3';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function updateTokenPrices() {
  const coinGeckoTokens = await (
    await fetch(`${API_URL}/coins/list?include_platform=true`)
  ).json();

  const numGroups = Math.ceil(coinGeckoTokens.length / 250);
  const tokenGroups = coinGeckoTokens.reduce((acc, token, i) => {
    // Put ids in alternating slots to create equal size groups
    const index = i % numGroups;
    acc[index].push(token);
    return acc;
  }, [...Array(numGroups)].map(x => []));

  const prices = (await Promise.all(
    tokenGroups.map(async (group, i) => {
      await wait(600 * i);
      const ids = group.map(({ id }) => id).join(",");

      const priceRes = await fetch(`${API_URL}/simple/price?ids=${ids}&vs_currencies=usd`);
      const priceJSON = await priceRes.json();

      const tickerToPrice = Object.keys(priceJSON).reduce((acc, targetID) => {
        const { symbol } = group.find(({ id }) => id === targetID);
        acc[symbol.toUpperCase()] = priceJSON[targetID].usd;
        return acc;
      }, {});

      return tickerToPrice;
    })
  ))
    // Combine results into one object
    .reduce((acc, priceObj) => ({...acc, ...priceObj}));

  fs.writeFileSync('./data/tokenPrices.json', JSON.stringify(prices));
}

module.exports = updateTokenPrices;

updateTokenPrices();