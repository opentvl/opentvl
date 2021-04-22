const Eth = require("web3-eth");
const Etherscan = require("./lib/etherscan");
const Bottleneck = require("bottleneck");
const HRC20 = require("./abis/erc20.json");
const tokenList = require("./data/hecoTokenLists.json");
const { getBalance, getBalances, getLogs, singleCall, multiCall } = require("./lib/web3");
const debug = require("debug")("opentvl:heco-api");
const { applyDecimals } = require("./lib/big-number");
const { getReservedBalances } = require("./lib/swap");

if (!process.env.HECO_RPC_URL) {
  throw new Error(`Please set environment variable HECO_RPC_URL`);
}

if (!process.env.HECO_SCAN_KEY) {
  throw new Error(`Please set environment variable HECO_SCAN_KEY`);
}

const HECO_RPC_URL = process.env.HECO_RPC_URL;
const HECO_SCAN_KEY = process.env.HECO_SCAN_KEY;

const HECO_WEB3 = new Eth(HECO_RPC_URL);
const HECO_SCAN = new Etherscan(HECO_SCAN_KEY, "https://api.hecoinfo.com/api");
const HECO_LIMITER = new Bottleneck({ maxConcurrent: 10, minTime: 50 });
const HECO_MULTICALL_PROVIDER = "0xe7144e57d832c9005d252f415d205b4b8d78228e";
const HECO_GET_LOGS_BATCH_SIZE = 5000;

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
const NATIVE_TOKEN_SYMBOL = "HT";
const NATIVE_TOKEN_DECIMALS = 18;

function mapStringToABI(abiString) {
  let abi;
  switch (abiString) {
    case "hrc20:symbol": {
      abi = HRC20.filter(t => t.name === "symbol")[0];
      break;
    }
    case "hrc20:decimals": {
      abi = HRC20.filter(t => t.name === "decimals")[0];
      break;
    }
    case "hrc20:balanceOf": {
      abi = HRC20.filter(t => t.name === "balanceOf")[0];
      break;
    }
    case "hrc20:totalSupply": {
      abi = HRC20.filter(t => t.name === "totalSupply")[0];
      break;
    }
    default:
      throw new Error(`Unknown string ABI: ${abiString}`);
  }
  return abi;
}

async function hrc20(method, target, params = []) {
  const abi = HRC20.find(item => item.type === "function" && item.name === method);

  return singleCall({
    web3: HECO_WEB3,
    limiter: HECO_LIMITER,
    target,
    abi,
    params
  });
}

async function abiCall({ target, abi, block, params }) {
  if (typeof abi === "string") {
    abi = mapStringToABI(abi);
  }
  debug("heco.abi.call", { target, abi, block, params });

  return singleCall({ web3: HECO_WEB3, limiter: HECO_LIMITER, target, abi, block, params });
}

async function abiMultiCall({ target, abi, block, calls }) {
  if (typeof abi === "string") {
    abi = mapStringToABI(abi);
  }
  debug("heco.abi.multiCall", { target, abi, block, calls });

  return multiCall({
    web3: HECO_WEB3,
    limiter: HECO_LIMITER,
    multiCallProvider: HECO_MULTICALL_PROVIDER,
    target,
    abi,
    block,
    calls
  });
}

async function utilGetLogs({ target, topic, topics, keys, fromBlock, toBlock }) {
  debug("heco.util.getLogs", { target, topic, topics, fromBlock, toBlock });

  return getLogs({
    web3: HECO_WEB3,
    scan: HECO_SCAN,
    limiter: HECO_LIMITER,
    batchSize: HECO_GET_LOGS_BATCH_SIZE,
    target,
    topic,
    topics,
    keys,
    fromBlock,
    toBlock
  });
}

async function utilTokenList() {
  debug("heco.util.tokenList");

  return tokenList;
}

async function utilToSymbols(addressesBalances) {
  debug("heco.util.toSymbols", addressesBalances);

  const normalAddresses = Object.keys(addressesBalances).filter(addr => addr !== NATIVE_TOKEN_ADDRESS);

  const symbolsRequests = await abiMultiCall({
    abi: "hrc20:symbol",
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

  debug("toSymbols symbolsByAddresses", symbolsByAddresses);

  const decimalsRequests = await abiMultiCall({
    abi: "hrc20:decimals",
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

  debug("toSymbols decimalsByAddresses", decimalsByAddresses);

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

async function htGetBalance({ target, block, decimals }) {
  debug("heco.ht.getBalance", { target, block, decimals });

  let { callCount, output } = await getBalance({
    web3: HECO_WEB3,
    limiter: HECO_LIMITER,
    target,
    block
  });

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function htGetBalances({ targets, block, decimals }) {
  debug("heco.ht.getBalances", { targets, block, decimals });

  let { callCount, output } = await getBalances({
    web3: HECO_WEB3,
    limiter: HECO_LIMITER,
    targets,
    block
  });

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function hrc20Info(target) {
  debug("heco.hrc20.info", { target });

  const { callCount: symbolCallCount, output: symbol } = await hrc20("symbol", target);
  const { callCount: decimalsCallCount, output: decimals } = await hrc20("decimals", target);

  return {
    callCount: symbolCallCount + decimalsCallCount,
    output: {
      symbol,
      decimals: parseInt(decimals)
    }
  };
}

async function hrc20Symbol(target) {
  debug("heco.hrc20.symbol", { target });

  return hrc20("symbol", target);
}

async function hrc20Decimals(target) {
  debug("heco.hrc20.decimals", { target });

  const { callCount: decimalsCallCount, output: decimals } = await hrc20("decimals", target);
  return {
    callCount: decimalsCallCount,
    output: parseInt(decimals)
  };
}

async function hrc20TotalSupply({ target, block, decimals }) {
  debug("heco.hrc20.totalSupply", { target, block, decimals });

  let { callCount, output } = await hrc20("totalSupply", target);

  if (decimals) {
    output = applyDecimals(output, decimals);
  }

  return { callCount, output };
}

async function hrc20BalanceOf({ target, owner, block, decimals }) {
  debug("heco.hrc20.balanceOf", { target, owner, block, decimals });

  let { callCount, output } = await hrc20("balanceOf", target, [owner]);

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
    toSymbols: utilToSymbols
  },
  ht: {
    getBalance: htGetBalance,
    getBalances: htGetBalances
  },
  hrc20: {
    info: hrc20Info,
    symbol: hrc20Symbol,
    decimals: hrc20Decimals,
    totalSupply: hrc20TotalSupply,
    balanceOf: hrc20BalanceOf
  },
  swap: {
    getReservedBalances: swapGetReservedBalances
  }
};
