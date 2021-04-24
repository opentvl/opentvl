const sdk = require("../../sdk");
const BigNumber = require("bignumber.js");

/*
  The SafeMoon protocol defines a coin that has a 10% transaction fee.
  - 5% of the fee goes to existing holders of SafeMoon
  - 2.5% of the fee is sold as BNB
  - 2.5% of the fee is deposited into a pancakeswap liquidity pool along with the 
  purchased BNB

  The protocol holds onto the LP tokens
*/

const SAFE_MOON_LP = "0x9adc6fb78cefa07e13e9294f150c1e8c1dd566c0";
const LOCKER = "0xc8b839b9226965caf1d9fc1551588aaf553a7be6";

async function getLPBalance(block) {
  return (
    await sdk.bsc.abi.call({
      target: SAFE_MOON_LP,
      abi: "bep20:balanceOf",
      block,
      params: LOCKER
    })
  ).output;
}

async function getTotalLPSupply(block) {
  return (
    await sdk.bsc.abi.call({
      target: SAFE_MOON_LP,
      abi: "bep20:totalSupply",
      block
    })
  ).output;
}

async function tvl(_, block) {
  const lpBalance = await getLPBalance(block.bsc);
  const totalLPSupply = await getTotalLPSupply(block.bsc);
  const percentPoolOwnership = new BigNumber(lpBalance).dividedBy(new BigNumber(totalLPSupply));

  const pairAddresses = [SAFE_MOON_LP];
  let balances = Object.entries(await sdk.bsc.swap.getReservedBalances(pairAddresses)).reduce((acc, [token, count]) => {
    const existingBalance = new BigNumber(count);
    acc[token] = existingBalance.multipliedBy(percentPoolOwnership).toFixed();
    return acc;
  }, {});

  balances[SAFE_MOON_LP] = lpBalance;

  return (await sdk.bsc.util.toSymbols(balances)).output;
}

module.exports = {
  version: "2", // to distinguish new version from old version
  name: "Safemoon",
  token: "SAFEMOON",
  category: "assets",
  start: 1614568378, //Mar-01-2021 03:12:58 AM +UTC
  tvl
};
