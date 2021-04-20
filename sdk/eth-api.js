const fetch = require("node-fetch");
const Eth = require("web3-eth");
const Etherscan = require("./lib/etherscan");
const Bottleneck = require("bottleneck");
const ERC20 = require("./abis/erc20.json");
const tokenList = require("./data/ethTokenLists.json");
const { getBalance, getBalances, getLogs, singleCall, multiCall } = require("./lib/web3");
const debug = require("debug")("opentvl:eth-api");
const { applyDecimals } = require("./lib/big-number");
const { getReservedBalances } = require("./lib/swap");

if (!process.env.ETH_RPC_URL) {
  throw new Error(`Please set environment variable ETH_RPC_URL`);
}

if (!process.env.ETH_SCAN_KEY) {
  throw new Error(`Please set environment variable ETH_SCAN_KEY`);
}

const ETH_RPC_URL = process.env.ETH_RPC_URL;
const ETH_SCAN_KEY = process.env.ETH_SCAN_KEY;

const ETH_WEB3 = new Eth(ETH_RPC_URL);
const ETH_SCAN = new Etherscan(ETH_SCAN_KEY, "https://api.etherscan.io/api");
const ETH_LIMITER = new Bottleneck({ maxConcurrent: 5, minTime: 100 });
const ETH_MULTICALL_PROVIDER = "0xCa731e0f33Afbcfa9363d6F7449d1f5447d10C80";
const ETH_GET_LOGS_BATCH_SIZE = 10000;

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
const NATIVE_TOKEN_SYMBOL = "ETH";
const NATIVE_TOKEN_DECIMALS = 18;

function mapStringToABI(abiString) {
  let abi;
  switch (abiString) {
    case "erc20:symbol": {
      abi = ERC20.filter(t => t.name === "symbol")[0];
      break;
    }
    case "erc20:decimals": {
      abi = ERC20.filter(t => t.name === "decimals")[0];
      break;
    }
    case "erc20:balanceOf": {
      abi = ERC20.filter(t => t.name === "balanceOf")[0];
      break;
    }
    case "erc20:totalSupply": {
      abi = ERC20.filter(t => t.name === "totalSupply")[0];
      break;
    }
    default:
      throw new Error(`Unknown string ABI: ${abiString}`);
  }
  return abi;
}

async function erc20(method, target, params = []) {
  const abi = ERC20.find(item => item.type === "function" && item.name === method);

  return singleCall({
    web3: ETH_WEB3,
    limiter: ETH_LIMITER,
    target,
    abi,
    params
  });
}

async function abiCall({ target, abi, block, params }) {
  if (typeof abi === "string") {
    abi = mapStringToABI(abi);
  }
  debug("eth.abi.call", { target, abi, block, params });

  return singleCall({ web3: ETH_WEB3, limiter: ETH_LIMITER, target, abi, block, params });
}

async function abiMultiCall({ target, abi, block, calls }) {
  if (typeof abi === "string") {
    abi = mapStringToABI(abi);
  }
  debug("eth.abi.multiCall", { target, abi, block, calls });

  return multiCall({
    web3: ETH_WEB3,
    limiter: ETH_LIMITER,
    multiCallProvider: ETH_MULTICALL_PROVIDER,
    target,
    abi,
    block,
    calls
  });
}

async function utilGetLogs({ target, topic, keys, fromBlock, toBlock }) {
  debug("eth.util.getLogs", { target, topic, fromBlock, toBlock });

  return getLogs({
    web3: ETH_WEB3,
    scan: ETH_SCAN,
    limiter: ETH_LIMITER,
    batchSize: ETH_GET_LOGS_BATCH_SIZE,
    target,
    topic,
    keys,
    fromBlock,
    toBlock
  });
}

async function utilTokenList() {
  debug("eth.util.tokenList");

  return tokenList;
}

async function utilKyberTokens() {
  debug("eth.util.kyberTokens");

  const kyberMarketRes = await fetch("https://api.kyber.network/market");

  if (!kyberMarketRes.ok) {
    debug("error in eth.util.kyberTokens", kyberMarketRes.status, await kyberMarketRes.text());

    throw new Error(`failed to fetch kyber market data`);
  }

  const { data } = await kyberMarketRes.json();

  return data.reduce((acc, pair) => {
    acc[pair.base_address] = { symbol: pair.base_symbol, decimals: pair.base_decimals };

    return acc;
  }, {});
}

async function utilToSymbols(addressesBalances) {
  debug("eth.util.toSymbols", addressesBalances);

  const normalAddresses = Object.keys(addressesBalances).filter(addr => addr !== NATIVE_TOKEN_ADDRESS);

  const symbolsRequests = await abiMultiCall({
    abi: "erc20:symbol",
    calls: normalAddresses.map(t => {
      return { target: t };
    })
  });
  const symbolsByAddresses = symbolsRequests.output.reduce(
    (acc, t) => {
      if (t.success) {
        acc[t.input.target] = t.output;
      }
      return acc;
    },
    {
      [NATIVE_TOKEN_ADDRESS]: NATIVE_TOKEN_SYMBOL
    }
  );

  const decimalsRequests = await abiMultiCall({
    abi: "erc20:decimals",
    calls: normalAddresses.map(t => {
      return { target: t };
    })
  });
  const decimalsByAddresses = decimalsRequests.output.reduce(
    (acc, t) => {
      if (t.success) {
        acc[t.input.target] = t.output;
      }
      return acc;
    },
    {
      [NATIVE_TOKEN_ADDRESS]: NATIVE_TOKEN_DECIMALS
    }
  );

  const output = Object.keys(addressesBalances).reduce((acc, addr) => {
    if (addressesBalances[addr] !== "NaN" && symbolsByAddresses[addr] && decimalsByAddresses[addr]) {
      acc[symbolsByAddresses[addr]] = applyDecimals(addressesBalances[addr], decimalsByAddresses[addr]);
    }

    return acc;
  }, {});

  return {
    callCount: symbolsRequests.callCount + decimalsRequests.callCount,
    output
  };
}

async function ethGetBalance({ target, block, decimals }) {
  debug("eth.eth.getBalance", { target, block, decimals });

  let { callCount, output } = await getBalance({
    web3: ETH_WEB3,
    limiter: ETH_LIMITER,
    target,
    block
  });

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function ethGetBalances({ targets, block, decimals }) {
  debug("eth.eth.getBalances", { targets, block, decimals });

  let { callCount, output } = await getBalances({
    web3: ETH_WEB3,
    limiter: ETH_LIMITER,
    targets,
    block
  });

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function erc20Info(target) {
  debug("eth.erc20.info", { target });

  const { callCount: symbolCallCount, output: symbol } = await erc20("symbol", target);
  const { callCount: decimalsCallCount, output: decimals } = await erc20("decimals", target);

  return {
    callCount: symbolCallCount + decimalsCallCount,
    output: {
      symbol,
      decimals: parseInt(decimals)
    }
  };
}

async function erc20Symbol(target) {
  debug("eth.erc20.symbol", { target });

  return erc20("symbol", target);
}

async function erc20Decimals(target) {
  debug("eth.erc20.decimals", { target });

  const { callCount: decimalsCallCount, output: decimals } = await erc20("decimals", target);
  return {
    callCount: decimalsCallCount,
    output: parseInt(decimals)
  };
}

async function erc20TotalSupply({ target, block, decimals }) {
  debug("eth.erc20.totalSupply", { target, block, decimals });

  let { callCount, output } = await erc20("totalSupply", target);

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function erc20BalanceOf({ target, owner, block, decimals }) {
  debug("eth.erc20.balanceOf", { target, owner, block, decimals });

  let { callCount, output } = await erc20("balanceOf", target, [owner]);

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function swapGetReservedBalances(pairAddresses) {
  return getReservedBalances({
    pairAddresses,
    tokenList: await utilTokenList(),
    multiCall: abiMultiCall
  });
}

module.exports = {
  abi: {
    call: abiCall,
    multiCall: abiMultiCall
  },
  util: {
    getLogs: utilGetLogs,
    tokenList: utilTokenList,
    kyberTokens: utilKyberTokens,
    toSymbols: utilToSymbols
    // ignore some apis not used by any adapters
    // getEthCallCount: () => util("getEthCallCount"),
    // resetEthCallCount: () => util("resetEthCallCount"),
    // unwrap: options => util("unwrap", { ...options }),
    // lookupBlock: timestamp => util("lookupBlock", { timestamp })
  },
  // to make api interface smoother
  // sdk.eth.getBalance
  getBalance: ethGetBalance,
  getBalances: ethGetBalances,
  // to keep compatibility
  // sdk.api.eth.getBalance
  eth: {
    getBalance: ethGetBalance,
    getBalances: ethGetBalances
  },
  erc20: {
    info: erc20Info,
    symbol: erc20Symbol,
    decimals: erc20Decimals,
    totalSupply: erc20TotalSupply,
    balanceOf: erc20BalanceOf
  },
  swap: {
    getReservedBalances: swapGetReservedBalances
  }
};
