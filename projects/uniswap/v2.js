const sdk = require('../../sdk');

const START_BLOCK = 10000835;
const FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';

module.exports = async function tvl(_, block) {
  const pairAddresses = await sdk.eth.swap.getPairAddresses(FACTORY, START_BLOCK, block);

  return await sdk.eth.swap.getReservedBalances(pairAddresses);
};
