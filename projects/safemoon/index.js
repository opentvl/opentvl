const sdk = require('../../sdk');

/*
  The SafeMoon protocol defines a coin that has a 10% transaction fee.
  - 5% of the fee goes to existing holders of SafeMoon
  - 2.5% of the fee is sold as BNB
  - 2.5% of the fee is deposited into a pancakeswap liquidity pool along with the 
  purchased BNB

  The protocol holds onto the LP tokens
*/

const SAFE_MOON = '0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3';
const SAFE_MOON_LP = '0x9adc6fb78cefa07e13e9294f150c1e8c1dd566c0';

async function getLPBalance(block) {
  const lpBalance = (await sdk.bsc.abi.call({
    target: SAFE_MOON_LP,
    abi: "bep20:balanceOf",
    block, 
    params: SAFE_MOON
  })).output;

  return lpBalance;
}

async function tvl(_, block) {
  const pairAddresses = [SAFE_MOON_LP];
  let balances = await sdk.bsc.swap.getReservedBalances(pairAddresses);
  balances[SAFE_MOON_LP] = await getLPBalance(block);

  return (await sdk.bsc.util.toSymbols(balances)).output
}

module.exports = {
  version: '2', // to distinguish new version from old version
  name: 'Safemoon',
  token: 'SAFEMOON',
  category: 'assets',
  start: 1614568378, //Mar-01-2021 03:12:58 AM +UTC
  tvl
}