const sdk = require('../../sdk')
const fetch = require('node-fetch')

// const START_BLOCK = 586851
// const FACTORY = '0xbcfccbde45ce874adcb698cc183debcf17952812'

/*async function getPairAddresses() {
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

  fs.writeFileSync('./pairAddresses.json', JSON.stringify(pairAddresses))

  return pairAddresses;
}*/

async function fetchPairAddresses() {
  const result = await (
    await fetch('https://api.pancakeswap.finance/api/v1/stat')
  ).json()

  const pairAddresses = result.trade_pairs.map(({ swap_pair_contract }) =>
    swap_pair_contract.toLowerCase()
  )

  return pairAddresses
}

async function tvl(_, block) {
  const pairAddresses = await fetchPairAddresses()

  const reserveBalances = await sdk.bsc.swap.getReservedBalances(pairAddresses)

  return (await sdk.bsc.util.toSymbols(reserveBalances)).output
}

module.exports = {
  version: '2', // to distinguish new version from old version
  name: 'PancakeSwap',
  token: 'CAKE',
  category: 'dexes',
  start: 1600753669, // Sep-22-2020 05:47:49 AM +UTC
  tvl
}
