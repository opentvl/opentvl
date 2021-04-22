const sdk = require('../../sdk');

const START_BLOCK = 470617;
const FACTORY = '0x01bf7c66c6bd861915cdaae475042d3c4bae16a7';

async function tvl(_, block) {
  const pairAddresses = await sdk.bsc.swap.getPairAddresses(FACTORY, START_BLOCK, block.bsc);
  const balances = await sdk.bsc.swap.getReservedBalances(pairAddresses);

  return (await sdk.bsc.util.toSymbols(balances)).output
}

module.exports = {
  version: '2', // to distinguish new version from old version
  name: 'BakerySwap',
  token: 'BAKE',
  category: 'dexes',
  start: 1541116800, // 11/02/2018 @ 12:00am (UTC)
  tvl
}
