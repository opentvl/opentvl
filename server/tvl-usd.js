const fetch = require("node-fetch");
const BigNumber = require("bignumber.js");
const sdk = require("../sdk");
const debug = require("debug")("opentvl:server:tvl-usd");

function normalizeSymbol(symbol) {
  const mapping = {
    WBNB: "BNB",
    WETH: "ETH",
    WBTC: "BTC",
    HDOT: "DOT",
    "UNI-V2": "UNI"
  };

  return mapping[symbol] || symbol;
}

const CHAINS = [
  {
    key: "eth",
    coingeckoKey: "ethereum",
    nativeTokenDecimals: 18,
    nativeTokenSymbol: "ETH",
    tokenList: sdk.eth.util.tokenList,
    getSymbol: sdk.eth.erc20.symbol,
    getDecimals: sdk.eth.erc20.decimals,
    getUSDPrice: sdk.eth.chainlink.getUSDPrice
  },
  {
    key: "bsc",
    coingeckoKey: "binance-smart-chain",
    nativeTokenDecimals: 18,
    nativeTokenSymbol: "BNB",
    tokenList: sdk.bsc.util.tokenList,
    getSymbol: sdk.bsc.bep20.symbol,
    getDecimals: sdk.bsc.bep20.decimals,
    getUSDPrice: sdk.bsc.chainlink.getUSDPrice
  },
  {
    key: "heco",
    coingeckoKey: "huobi-token",
    nativeTokenDecimals: 18,
    nativeTokenSymbol: "HT",
    tokenList: sdk.heco.util.tokenList,
    getSymbol: sdk.heco.hrc20.symbol,
    getDecimals: sdk.heco.hrc20.decimals,
    getUSDPrice: sdk.heco.chainlink.getUSDPrice
  }
];

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

function getTvlFromTokenList(topTokens, address, amt) {
  const addr = address.toLowerCase();

  const token = topTokens.find(t => t.contract.toLowerCase() === addr);

  if (token) {
    return {
      source: "tokenlist",
      symbol: token.symbol,
      price: token.price,
      decimals: token.decimals,
      usd: new BigNumber(token.price).multipliedBy(sdk.util.applyDecimals(amt, token.decimals))
    };
  }

  return null;
}

async function getTvlFromChainlink(chain, symbol, address, amt) {
  try {
    const price = await chain.getUSDPrice(normalizeSymbol(symbol));

    if (!price) {
      return null;
    }

    const decimals = (await chain.getDecimals(address)).output;

    return {
      source: "chainlink",
      symbol,
      price,
      decimals,
      usd: new BigNumber(price).multipliedBy(sdk.util.applyDecimals(amt, decimals))
    };
  } catch (err) {
    console.log(`error get tvl from chainlink`, err);

    return null;
  }
}

async function getTvlFromCoingecko(chain, symbol, address, amt) {
  const priceRes = await fetch(
    `https://api.coingecko.com/api/v3/simple/token_price/${
      chain.coingeckoKey
    }?contract_addresses=${address.toLowerCase()}&vs_currencies=usd`
  );

  const priceData = await priceRes.json();
  const price = priceData[address.toLowerCase()]?.usd;

  if (!price) {
    return null;
  }

  const decimals = (await chain.getDecimals(address)).output;

  return {
    source: "coingecko",
    symbol,
    price,
    decimals,
    usd: new BigNumber(price).multipliedBy(sdk.util.applyDecimals(amt, decimals))
  };
}

async function getTvlForOneAddress(chain, address, amt) {
  if (address === NATIVE_TOKEN_ADDRESS) {
    const nativeTokenPrice = await chain.getUSDPrice(chain.nativeTokenSymbol);

    return {
      source: "nativetoken",
      symbol: chain.nativeTokenSymbol,
      price: nativeTokenPrice,
      decimals: chain.nativeTokenDecimals,
      usd: new BigNumber(nativeTokenPrice).multipliedBy(sdk.util.applyDecimals(amt, chain.nativeTokenDecimals))
    };
  }

  const topTokens = await chain.tokenList();

  const tvlFromTokenList = getTvlFromTokenList(topTokens, address, amt);

  if (tvlFromTokenList) {
    return tvlFromTokenList;
  }

  const allTokenSymbols = topTokens.map(t => t.symbol);

  try {
    const symbol = (await chain.getSymbol(address)).output;

    // ignore long tail tokens
    if (allTokenSymbols.includes(symbol)) {
      debug(`ignored a not well known token ${symbol} at address ${address}`);

      return null;
    }

    const tvlFromChainlink = await getTvlFromChainlink(chain, symbol, address, amt);

    if (tvlFromChainlink) {
      return tvlFromChainlink;
    }

    const tvlFromCoingecko = await getTvlFromCoingecko(chain, symbol, address, amt);

    if (tvlFromCoingecko) {
      return tvlFromCoingecko;
    }

    return null;
  } catch (getSymbolErr) {
    debug(`get symbol err for address ${address}`, getSymbolErr);

    return null;
  }
}

async function computeTVLUSD(locked) {
  let total = BigNumber(0);
  const byChainByContract = {};

  for (let chain of CHAINS) {
    if (locked[chain.key]) {
      const lockedTokens = locked[chain.key];

      byChainByContract[chain.key] = {};

      let tvl = BigNumber(0);

      for (let address in lockedTokens) {
        const amt = lockedTokens[address];

        const one = await getTvlForOneAddress(chain, address, amt);

        if (one) {
          byChainByContract[chain.key][address] = {
            source: one.source,
            symbol: one.symbol,
            decimals: one.decimals,
            price: one.price,
            amount: amt,
            usdAmount: one.usd.toNumber()
          };

          tvl = tvl.plus(one.usd);
        } else {
          byChainByContract[chain.key][address] = {
            source: null,
            symbol: null,
            price: null,
            amount: amt,
            usdAmount: null
          };
        }
      }

      debug(`${chain.key} tvl is ${tvl.toNumber()}`);

      total = total.plus(tvl);
    }
  }

  debug(`tvl USD summary`, JSON.stringify(byChainByContract, null, 2));

  return total.toNumber();
}

module.exports = computeTVLUSD;
