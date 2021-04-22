const _ = require('underscore');

const BigNumber = require("bignumber.js");
const SWAP = require("../abis/swap.json");

const TOKEN0_ABI = SWAP.find(item => item.name === "token0");
const TOKEN1_ABI = SWAP.find(item => item.name === "token1");
const GET_RESERVES_ABI = SWAP.find(item => item.name === "getReserves");

async function getPairAddresses({ factoryAddress, fromBlock, toBlock, getLogs }) {
  const logs = (
    await getLogs({
      keys: [],
      toBlock,
      target: factoryAddress,
      fromBlock,
      topic: 'PairCreated(address,address,address,uint256)'
    })
  ).output;

  const pairAddresses = logs
    // sometimes the full log is emitted
    .map(log =>
      typeof log === 'string' ? log : `0x${log.data.slice(64 - 40 + 2, 64 + 2)}`
    )
    // lowercase
    .map(pairAddress => pairAddress.toLowerCase())

  return pairAddresses;
}

async function getReservedBalances({ pairAddresses, tokenList, multiCall }) {
  const supportedTokens = tokenList.map(({ contract }) => contract);

  const [token0Addresses, token1Addresses] = await Promise.all([
    multiCall({
      abi: TOKEN0_ABI,
      calls: pairAddresses.map(pairAddress => ({
        target: pairAddress
      }))
    }).then(({ output }) => output),
    multiCall({
      abi: TOKEN1_ABI,
      calls: pairAddresses.map(pairAddress => ({
        target: pairAddress
      }))
    }).then(({ output }) => output)
  ]);

  const pairs = {};
  // add token0Addresses
  token0Addresses.forEach(token0Address => {
    if (token0Address.success) {
      const tokenAddress = token0Address.output.toLowerCase();

      if (supportedTokens.includes(tokenAddress)) {
        const pairAddress = token0Address.input.target.toLowerCase();
        pairs[pairAddress] = {
          token0Address: tokenAddress
        };
      }
    }
  });

  // add token1Addresses
  token1Addresses.forEach(token1Address => {
    if (token1Address.success) {
      const tokenAddress = token1Address.output.toLowerCase();
      if (supportedTokens.includes(tokenAddress)) {
        const pairAddress = token1Address.input.target.toLowerCase();
        pairs[pairAddress] = {
          ...(pairs[pairAddress] || {}),
          token1Address: tokenAddress
        };
      }
    }
  });

  const reserves = (
    await multiCall({
      abi: GET_RESERVES_ABI,
      calls: Object.keys(pairs).map(pairAddress => ({
        target: pairAddress
      }))
    })
  ).output;

  const reserveBalances = reserves.reduce((accumulator, reserve, i) => {
    if (reserve.success) {
      const pairAddress = reserve.input.target.toLowerCase();
      const pair = pairs[pairAddress] || {};

      // handle reserve0
      if (pair.token0Address) {
        const reserve0 = new BigNumber(reserve.output["0"]);
        if (!reserve0.isZero()) {
          const existingBalance = new BigNumber(accumulator[pair.token0Address] || "0");

          accumulator[pair.token0Address] = existingBalance.plus(reserve0).toFixed();
        }
      }

      // handle reserve1
      if (pair.token1Address) {
        const reserve1 = new BigNumber(reserve.output["1"]);

        if (!reserve1.isZero()) {
          const existingBalance = new BigNumber(accumulator[pair.token1Address] || "0");

          accumulator[pair.token1Address] = existingBalance.plus(reserve1).toFixed();
        }
      }
    }

    return accumulator;
  }, {});

  return reserveBalances;
}

module.exports = {
  getReservedBalances,
  getPairAddresses
};
