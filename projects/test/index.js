const sdk = require('../../sdk')

const CAKE = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'
const CAKE_CREATOR = '0x0f9399fc81dac77908a2dde54bb87ee2d17a3373'

const AAVE = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'
const AAVE_CREATOR = '0x51f22ac850d29c879367a77d241734acb276b815'

const MDEX = '0x25d2e80cb6b86881fd7e07dd263fb79f4abe033c'
const MDEX_CREATOR = '0x06f46644d6e6d044ab008fb23bdc5bf3529bf3f0'

async function tvl(_, block) {
  /* test block */
  console.log('eth (latest) block id', block.eth)
  console.log('bsc (latest) block id', block.bsc)

  /* test ETH apis */
  console.log('sdk.eth.erc20.info', (await sdk.eth.erc20.info(AAVE)).output)
  console.log('sdk.eth.erc20.symbol', (await sdk.eth.erc20.symbol(AAVE)).output)
  console.log(
    'sdk.eth.erc20.decimals',
    (await sdk.eth.erc20.decimals(AAVE)).output
  )
  console.log(
    'sdk.eth.erc20.totalSupply',
    (await sdk.eth.erc20.totalSupply({ target: AAVE })).output
  )
  console.log(
    'sdk.eth.erc20.balanceOf',
    (await sdk.eth.erc20.balanceOf({ target: AAVE, owner: AAVE_CREATOR }))
      .output
  )
  console.log(
    'sdk.eth.getBalance',
    (await sdk.eth.getBalance({ target: AAVE })).output
  )
  console.log(
    'sdk.eth.getBalances',
    (await sdk.eth.getBalances({ targets: [AAVE, AAVE_CREATOR] })).output
  )
  console.log(
    'sdk.eth.util.getLogs',
    (
      await sdk.eth.util.getLogs({
        target: AAVE,
        fromBlock: 11119807,
        toBlock: 11119900,
        topic: 'Transfer(from,to,value)'
      })
    ).output
  )
  console.log('sdk.eth.util.tokenList', (await sdk.eth.util.tokenList()).length)
  console.log('sdk.eth.util.kyberTokens', await sdk.eth.util.kyberTokens())
  console.log(
    'sdk.eth.abi.call',
    await sdk.eth.abi.call({
      target: AAVE,
      abi: 'erc20:balanceOf',
      params: [AAVE_CREATOR]
    })
  )
  console.log(
    'sdk.eth.abi.multiCall',
    await sdk.eth.abi.multiCall({
      target: AAVE,
      abi: 'erc20:balanceOf',
      calls: [{ params: [AAVE_CREATOR] }, { params: [AAVE] }]
    })
  )

  /* test bsc apis */
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
    (await sdk.bsc.bep20.balanceOf({ target: CAKE, owner: CAKE_CREATOR }))
      .output
  )
  console.log(
    'sdk.bsc.bnb.getBalance',
    (await sdk.bsc.bnb.getBalance({ target: CAKE })).output
  )
  console.log(
    'sdk.bsc.bnb.getBalances',
    (await sdk.bsc.bnb.getBalances({ targets: [CAKE, CAKE_CREATOR] })).output
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
  console.log('sdk.bsc.util.tokenList', (await sdk.bsc.util.tokenList()).length)
  console.log(
    'sdk.bsc.abi.call',
    await sdk.bsc.abi.call({
      target: CAKE,
      abi: 'bep20:balanceOf',
      params: [CAKE_CREATOR]
    })
  )
  console.log(
    'sdk.bsc.abi.multiCall',
    await sdk.bsc.abi.multiCall({
      target: CAKE,
      abi: 'bep20:balanceOf',
      calls: [{ params: [CAKE_CREATOR] }, { params: [CAKE] }]
    })
  )

  /* test heco apis */
  console.log('sdk.heco.hrc20.info', (await sdk.heco.hrc20.info(MDEX)).output)
  console.log(
    'sdk.heco.hrc20.symbol',
    (await sdk.heco.hrc20.symbol(MDEX)).output
  )
  console.log(
    'sdk.heco.hrc20.decimals',
    (await sdk.heco.hrc20.decimals(MDEX)).output
  )
  console.log(
    'sdk.heco.hrc20.totalSupply',
    (await sdk.heco.hrc20.totalSupply({ target: MDEX })).output
  )
  console.log(
    'sdk.heco.hrc20.balanceOf',
    (await sdk.heco.hrc20.balanceOf({ target: MDEX, owner: MDEX_CREATOR }))
      .output
  )
  console.log(
    'sdk.heco.ht.getBalance',
    (await sdk.heco.ht.getBalance({ target: MDEX })).output
  )
  console.log(
    'sdk.heco.ht.getBalances',
    (await sdk.heco.ht.getBalances({ targets: [MDEX, MDEX_CREATOR] })).output
  )
  console.log(
    'sdk.heco.util.getLogs',
    (
      await sdk.heco.util.getLogs({
        target: MDEX,
        fromBlock: 4019000,
        toBlock: 4019100,
        topic: 'Transfer(from,to,value)'
      })
    ).output
  )
  console.log(
    'sdk.heco.util.tokenList',
    (await sdk.heco.util.tokenList()).length
  )
  console.log(
    'sdk.heco.abi.call',
    await sdk.heco.abi.call({
      target: MDEX,
      abi: 'hrc20:balanceOf',
      params: [MDEX_CREATOR]
    })
  )
  console.log(
    'sdk.heco.abi.multiCall',
    await sdk.heco.abi.multiCall({
      target: MDEX,
      abi: 'hrc20:balanceOf',
      calls: [{ params: [MDEX_CREATOR] }, { params: [MDEX] }]
    })
  )

  return {}
}

module.exports = {
  version: '2', // to distinguish old version from new version
  name: 'Test',
  token: 'TEST',
  category: 'dexes',
  start: 1541116800, // 11/02/2018 @ 12:00am (UTC)
  tvl
}
