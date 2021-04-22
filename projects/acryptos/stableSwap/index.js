/*==================================================
  Modules
  ==================================================*/

const sdk = require("../../../sdk");
const _ = require("underscore");
const BigNumber = require("bignumber.js");
_.flatMap = _.compose(_.flatten, _.map);
const debug = require("debug")("opentvl:acryptos:stableswap");
const abi = require("./abi.json");

/*==================================================
  TVL
  ==================================================*/

function applyDecimals(bigNumber, decimals) {
  const dividend = new BigNumber(10).exponentiatedBy(new BigNumber(decimals));

  return new BigNumber(bigNumber).dividedBy(dividend).toString();
}

async function tvl(timestamp, block) {
  let curvePools = [
    "0xb3F0C9ea1F05e312093Fdb031E789A756659B0AC", // ACS4USD StableSwap
    "0x191409D5A4EfFe25b0f4240557BA2192D18a191e", // ACS4VAI StableSwap
    "0x3919874C7bc0699cF59c981C5eb668823FA4f958", // ACS4QUSD StableSwap
    "0x99c92765EfC472a9709Ced86310D64C4573c4b77", // ACS4UST StableSwap
    "0xbE7CAa236544d1B9A0E7F91e94B9f5Bfd3B5ca81", // ACS3BTC StableSwap
  ];
  let balances = {};
  let poolInfo = {};

  let poolCount = curvePools.length;

  for (let i = 0; i < poolCount; i++) {
    let poolAddress = curvePools[i];
    poolInfo[poolAddress] = {};

    for (let x = 0; ; x++) {
      try {
        let coin = await sdk.bsc.abi.call({
          block,
          target: poolAddress,
          abi: abi["coins128"],
          params: x,
        });

        if (coin.output) {
          let balance = await sdk.bsc.abi.call({
            block,
            target: poolAddress,
            abi: abi["balances128"],
            params: x,
          });
          if (balance.output) {
            poolInfo[poolAddress][coin.output] = balance.output;
          }
        }
      } catch (e) {
        try {
          let coin = await sdk.bsc.abi.call({
            block,
            target: poolAddress,
            abi: abi["coins256"],
            params: x,
          });

          if (coin.output) {
            let balance = await sdk.bsc.abi.call({
              block,
              target: poolAddress,
              abi: abi["balances256"],
              params: x,
            });
            if (balance.output) {
              poolInfo[poolAddress][coin.output] = balance.output;
            }
          }
        } catch (e) {
          break;
        }
      }
    }
  }

  let poolKeys = Object.keys(poolInfo);
  for (let i = 0; i < poolKeys.length; i++) {
    let coinKeys = Object.keys(poolInfo[poolKeys[i]]);

    for (let x = 0; x < coinKeys.length; x++) {
      if (!balances[coinKeys[x]]) balances[coinKeys[x]] = 0;

      balances[coinKeys[x]] = BigNumber(balances[coinKeys[x]]).plus(BigNumber(poolInfo[poolKeys[i]][coinKeys[x]]));
    }
  }

  debug("raw balances", balances);

  // convert acs4 price to busd price
  const acs4Price = (
    await sdk.bsc.abi.call({
      target: "0xb3F0C9ea1F05e312093Fdb031E789A756659B0AC", // ACS4USD StableSwap
      abi: abi["get_virtual_price"],
    })
  ).output;
  balances["0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"] = balances["0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"].plus(
    balances["0x83D69Ef5c9837E21E2389D47d791714F5771F29b"].times(applyDecimals(acs4Price, 18))
  );
  delete balances["0x83D69Ef5c9837E21E2389D47d791714F5771F29b"];

  debug("fixed balances", balances);

  return balances;
}

/*==================================================
  Exports
  ==================================================*/

module.exports = { tvl };
