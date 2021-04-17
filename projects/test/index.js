const BigNumber = require('bignumber.js')

const sdk = require('../../sdk')
const token0 = require('./abis/token0.json')
const token1 = require('./abis/token1.json')
const getReserves = require('./abis/getReserves.json')

// const START_BLOCK = 586851
// for testing we can use a smaller range
const START_BLOCK = 6548398
const FACTORY = '0xbcfccbde45ce874adcb698cc183debcf17952812'
const CAKE = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'

async function tvl(_, block) {
  console.log('sdk.bsc.bep20.info', (await sdk.bsc.bep20.info(CAKE)).output)

  console.log('sdk.bsc.bep20.symbol', (await sdk.bsc.bep20.symbol(CAKE)).output)

  console.log(
    'sdk.bsc.bep20.decimals',
    (await sdk.bsc.bep20.decimals(CAKE)).output
  )

  console.log(
    'sdk.bsc.bep20.totalSupply',
    (await sdk.bsc.bep20.totalSupply({ target: CAKE })).output
  )

  console.log(
    'sdk.bsc.bep20.balanceOf',
    (await sdk.bsc.bep20.balanceOf({ target: CAKE, owner: FACTORY })).output
  )

  console.log(
    'sdk.bsc.bnb.getBalance',
    (await sdk.bsc.bnb.getBalance({ target: CAKE })).output
  )

  console.log(
    'sdk.bsc.bnb.getBalances',
    (await sdk.bsc.bnb.getBalances({ targets: [CAKE, FACTORY] })).output
  )

  console.log(
    'sdk.bsc.util.getLogs',
    (
      await sdk.bsc.util.getLogs({
        target: CAKE,
        fromBlock: 6578300,
        toBlock: 6578315,
        topic: 'Transfer(from,to,value)'
      })
    ).output
  )

  console.log('sdk.bsc.util.tokenList', await sdk.bsc.util.tokenList())

  console.log(
    'sdk.bsc.util.toSymbols',
    (
      await sdk.bsc.util.toSymbols({
        [CAKE]: 123456
      })
    ).output
  )

  console.log(
    'sdk.bsc.abi.call',
    await sdk.bsc.abi.call({
      target: CAKE,
      abi: 'bep20:balanceOf',
      params: [FACTORY]
    })
  )

  console.log(
    'sdk.bsc.abi.multiCall',
    await sdk.bsc.abi.multiCall({
      target: CAKE,
      abi: 'bep20:balanceOf',
      calls: [{ params: [FACTORY] }, { params: [CAKE] }]
    })
  )

  const supportedTokens = await sdk.bsc.util
    .tokenList()
    .then(supportedTokens => supportedTokens.map(({ contract }) => contract))

  const logs = (
    await sdk.bsc.util.getLogs({
      keys: [],
      toBlock: block.bsc,
      target: FACTORY,
      fromBlock: START_BLOCK,
      topic: 'PairCreated(address,address,address,uint256)'
    })
  ).output

  const pairAddresses = logs
    // sometimes the full log is emitted
    .map(log =>
      typeof log === 'string' ? log : `0x${log.data.slice(64 - 40 + 2, 64 + 2)}`
    )
    // lowercase
    .map(pairAddress => pairAddress.toLowerCase())

  const [token0Addresses, token1Addresses] = await Promise.all([
    sdk.bsc.abi
      .multiCall({
        abi: token0,
        calls: pairAddresses.map(pairAddress => ({
          target: pairAddress
        })),
        block: block.bsc
      })
      .then(({ output }) => output),
    sdk.bsc.abi
      .multiCall({
        abi: token1,
        calls: pairAddresses.map(pairAddress => ({
          target: pairAddress
        })),
        block: block.bsc
      })
      .then(({ output }) => output)
  ])

  const pairs = {}
  // add token0Addresses
  token0Addresses.forEach(token0Address => {
    if (token0Address.success) {
      const tokenAddress = token0Address.output.toLowerCase()

      if (supportedTokens.includes(tokenAddress)) {
        const pairAddress = token0Address.input.target.toLowerCase()
        pairs[pairAddress] = {
          token0Address: tokenAddress
        }
      }
    }
  })

  // add token1Addresses
  token1Addresses.forEach(token1Address => {
    if (token1Address.success) {
      const tokenAddress = token1Address.output.toLowerCase()
      if (supportedTokens.includes(tokenAddress)) {
        const pairAddress = token1Address.input.target.toLowerCase()
        pairs[pairAddress] = {
          ...(pairs[pairAddress] || {}),
          token1Address: tokenAddress
        }
      }
    }
  })

  const reserves = (
    await sdk.bsc.abi.multiCall({
      abi: getReserves,
      calls: Object.keys(pairs).map(pairAddress => ({
        target: pairAddress
      })),
      block: block.bsc
    })
  ).output

  const nums = reserves.reduce((accumulator, reserve, i) => {
    if (reserve.success) {
      const pairAddress = reserve.input.target.toLowerCase()
      const pair = pairs[pairAddress] || {}

      // handle reserve0
      if (pair.token0Address) {
        const reserve0 = new BigNumber(reserve.output['0'])
        if (!reserve0.isZero()) {
          const existingBalance = new BigNumber(
            accumulator[pair.token0Address] || '0'
          )

          accumulator[pair.token0Address] = existingBalance
            .plus(reserve0)
            .toFixed()
        }
      }

      // handle reserve1
      if (pair.token1Address) {
        const reserve1 = new BigNumber(reserve.output['1'])

        if (!reserve1.isZero()) {
          const existingBalance = new BigNumber(
            accumulator[pair.token1Address] || '0'
          )

          accumulator[pair.token1Address] = existingBalance
            .plus(reserve1)
            .toFixed()
        }
      }
    }

    return accumulator
  }, {})

  return (await sdk.bsc.util.toSymbols(nums)).output
}

module.exports = {
  version: '2', // to distinguish old version from new version
  name: 'Test',
  token: 'TEST',
  category: 'dexes',
  start: 1541116800, // 11/02/2018 @ 12:00am (UTC)
  tvl
}
