const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { parse } = require("node-html-parser");
const BigNumber = require("bignumber.js");
const sdk = require("../sdk");
const Bottleneck = require("bottleneck");
const debug = require("debug")("opentvl:server:tvl-usd");

const COINGECKO_LIMITER = new Bottleneck({ maxConcurrent: 2, minTime: 400 });
const SCAN_LIMITER = new Bottleneck({ maxConcurrent: 1, minTime: 2000 });

function normalizeSymbol(symbol) {
  const mapping = {
    WBNB: "BNB",
    WETH: "ETH",
    WBTC: "BTC",
    HDOT: "DOT",
    "UNI-V2": "UNI",
  };

  return mapping[symbol] || symbol;
}

const CHAINS = [
  {
    key: "eth",
    scanUrl: "https://etherscan.io",
    coingeckoKey: "ethereum",
    nativeTokenDecimals: 18,
    nativeTokenSymbol: "ETH",
    tokenList: sdk.eth.util.tokenList,
    getSymbol: sdk.eth.erc20.symbol,
    getDecimals: sdk.eth.erc20.decimals,
    getUSDPrice: sdk.eth.chainlink.getUSDPrice,
  },
  {
    key: "bsc",
    scanUrl: "https://bscscan.com",
    coingeckoKey: "binance-smart-chain",
    nativeTokenDecimals: 18,
    nativeTokenSymbol: "BNB",
    tokenList: sdk.bsc.util.tokenList,
    getSymbol: sdk.bsc.bep20.symbol,
    getDecimals: sdk.bsc.bep20.decimals,
    getUSDPrice: sdk.bsc.chainlink.getUSDPrice,
  },
  {
    key: "heco",
    scanUrl: "https://hecoinfo.com",
    coingeckoKey: "huobi-token",
    nativeTokenDecimals: 18,
    nativeTokenSymbol: "HT",
    tokenList: sdk.heco.util.tokenList,
    getSymbol: sdk.heco.hrc20.symbol,
    getDecimals: sdk.heco.hrc20.decimals,
    getUSDPrice: sdk.heco.chainlink.getUSDPrice,
  },
];

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

function getTvlFromTokenList(chain, topTokens, address, amt) {
  const addr = address.toLowerCase();

  const token = topTokens.find((t) => t.contract.toLowerCase() === addr);

  if (token) {
    return {
      source: `${chain.scanUrl}/tokens`,
      symbol: token.symbol,
      price: token.price,
      decimals: token.decimals,
      usd: new BigNumber(token.price).multipliedBy(sdk.util.applyDecimals(amt, token.decimals)),
    };
  }

  return null;
}

function extractAmount(amt) {
  return parseFloat(amt.slice(1, amt.length).replace(/,/g, ""));
}

const rateLimitedScanFetch = SCAN_LIMITER.wrap(fetch);

async function getTvlFromScan(chain, address, amt) {
  const addr = address.toLowerCase();
  const url = `${chain.scanUrl}/token/${addr}`;

  const pageRes = await rateLimitedScanFetch(url);

  if (!pageRes.ok) {
    return null;
  }

  const html = await pageRes.text();

  const root = parse(html);

  const priceContainer = root.querySelector("#ContentPlaceHolder1_tr_valuepertoken");
  if (!priceContainer) {
    debug(`cannot find price container from scan html`, url);
    fs.writeFileSync(`/tmp/${chain.key}-${address}`, html);
    return null;
  }

  const priceCol = priceContainer.querySelector(".d-block");
  const price = extractAmount(priceCol.innerHTML.slice(0, priceCol.innerHTML.indexOf("<")).trim());

  const decimalsContainer = root.querySelector("#ContentPlaceHolder1_trDecimals");
  if (!decimalsContainer) {
    debug(`cannot find decimals container from scan html`, url);
    return null;
  }

  const decimalsCol = decimalsContainer.querySelector(".col-md-8");
  const decimals = decimalsCol.innerHTML.trim();

  const symbolField = root.querySelector("#ContentPlaceHolder1_hdnSymbol");
  const symbol = symbolField ? symbolField.getAttribute("value").trim() : "UNKOWN";

  return {
    source: url,
    symbol,
    price,
    decimals,
    usd: new BigNumber(price).multipliedBy(sdk.util.applyDecimals(amt, decimals)),
  };
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
      usd: new BigNumber(price).multipliedBy(sdk.util.applyDecimals(amt, decimals)),
    };
  } catch (err) {
    console.log(`error get tvl from chainlink`, err);

    return null;
  }
}

const rateLimitedCoingeckoFetch = COINGECKO_LIMITER.wrap(fetch);

async function getTvlFromCoingecko(chain, symbol, address, amt) {
  const coinGeckoProjects = JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".database", "coinGeckoIDs.json")));

  const project = coinGeckoProjects.find((p) => {
    if (!p.platforms[chain.coingeckoKey]) {
      return false;
    }

    return p.platforms[chain.coingeckoKey] === address.toLowerCase();
  });

  if (!project) {
    return null;
  }

  const priceRes = await rateLimitedCoingeckoFetch(
    `https://api.coingecko.com/api/v3/simple/token_price/${
      chain.coingeckoKey
    }?contract_addresses=${address.toLowerCase()}&vs_currencies=usd`
  );

  if (!priceRes.ok) {
    return null;
  }

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
    usd: new BigNumber(price).multipliedBy(sdk.util.applyDecimals(amt, decimals)),
  };
}

async function getTvlForOneAddress(chain, address, amt) {
  debug(`getTvlForOneAddress ${chain.key} ${address} ${amt}`);

  if (address === NATIVE_TOKEN_ADDRESS) {
    const nativeTokenPrice = await chain.getUSDPrice(chain.nativeTokenSymbol);

    return {
      source: "nativetoken",
      symbol: chain.nativeTokenSymbol,
      price: nativeTokenPrice,
      decimals: chain.nativeTokenDecimals,
      usd: new BigNumber(nativeTokenPrice).multipliedBy(sdk.util.applyDecimals(amt, chain.nativeTokenDecimals)),
    };
  }

  const topTokens = await chain.tokenList();

  const tvlFromTokenList = getTvlFromTokenList(chain, topTokens, address, amt);

  if (tvlFromTokenList) {
    return tvlFromTokenList;
  }

  const tvlFromScan = getTvlFromScan(chain, address, amt);

  if (tvlFromScan) {
    return tvlFromScan;
  }

  const allTokenSymbols = topTokens.map((t) => t.symbol);

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
            usdAmount: one.usd.toNumber(),
          };

          tvl = tvl.plus(one.usd);
        } else {
          byChainByContract[chain.key][address] = {
            source: null,
            symbol: null,
            price: null,
            amount: amt,
            usdAmount: null,
          };
          debug(`Cannot find price for token ${address} in chain ${chain.key}`);
        }
      }

      debug(`${chain.key} tvl is ${tvl.toNumber()}`);

      total = total.plus(tvl);
    }
  }

  debug(`tvl USD summary`, JSON.stringify(byChainByContract, null, 2));

  return { USD: total.toNumber(), SUMMARY: byChainByContract };
}

module.exports = computeTVLUSD;
