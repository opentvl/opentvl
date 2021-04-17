const fetch = require("node-fetch");
const { parse } = require('node-html-parser');
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchPairAddresses() {
  const result = await (
    await fetch("https://api.pancakeswap.finance/api/v1/stat")
  ).json();

  const pairAddresses = result.trade_pairs
    .map(({ swap_pair_contract }) => swap_pair_contract.toLowerCase())

  return pairAddresses;
}

async function main() {
  const pairAddresses = await fetchPairAddresses();
  //const pairAddresses = ['0x7a34bd64d18e44cfde3ef4b81b87baf3eb3315b6']

  const creators = await Promise.all(
    pairAddresses.map(async (address, i) => {
      await wait(i * 1000);
      const res = await fetch(`https://bscscan.com/address/${address}`);
      const html = await res.text();
      const root = parse(html);
      const elem = root.querySelector('#ContentPlaceHolder1_trContract > div > div.col-md-8 > a');

      if (elem) {
        const creator = elem.text;
        return creator;
      } else {
        console.log("Cannot find creator for address", address);
      }
    })
  );

  const unique = creators.reduce((acc, creator) => {
    if (creator) {
      acc.add(creator);
    }
    
    return acc;
  }, new Set());

  console.log("UNIQUE", unique.size, Array.from(unique))
}

main();