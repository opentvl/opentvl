const Eth = require("web3-eth");
const Etherscan = require("./lib/etherscan");
const Bottleneck = require("bottleneck");
const BEP20 = require("./abis/bep20.json");
const tokenList = require("./data/bscTokenLists.json");
const { getBalance, getBalances, getLogs, singleCall, multiCall } = require("./lib/web3");
const { toSymbols } = require("./lib/address");
const debug = require("debug")("bsc-api");
const { providers } = require("@0xsequence/multicall");
const { providers: ethersProviders } = require("ethers");
const BigNumber = require("bignumber.js");

if (!process.env.BSC_RPC_URL) {
  throw new Error(`Please set environment variable BSC_RPC_URL`);
}

if (!process.env.BSC_SCAN_KEY) {
  throw new Error(`Please set environment variable BSC_SCAN_KEY`);
}

const BSC_RPC_URL = process.env.BSC_RPC_URL;
const BSC_SCAN_KEY = process.env.BSC_SCAN_KEY;

const BSC_WEB3 = new Eth(BSC_RPC_URL);
const BSC_SCAN = new Etherscan(BSC_SCAN_KEY, "https://api.bscscan.com/api");
const BSC_LIMITER = new Bottleneck({ maxConcurrent: 10, minTime: 50 });

const multiCallProvider = new providers.MulticallProvider(
  new ethersProviders.JsonRpcProvider(process.env.BSC_RPC_URL),
  {
    batchSize: 500,
    verbose: false,
    contract: "0xe7144e57d832c9005D252f415d205b4b8D78228e",
  }
);

function getCachedFunction(abiString) {
  let abi;
  switch (abiString) {
    case "bep20:symbol": {
      abi = BEP20.filter((t) => t.name === "symbol")[0];
      break;
    }
    case "bep20:decimals": {
      abi = BEP20.filter((t) => t.name === "decimals")[0];
      break;
    }
    case "bep20:balanceOf": {
      abi = BEP20.filter((t) => t.name === "balanceOf")[0];
      break;
    }
    case "bep20:totalSupply": {
      abi = BEP20.filter((t) => t.name === "totalSupply")[0];
      break;
    }
    default:
      throw new Error("Unknown string ABI");
  }
  return abi;
}

async function bep20(method, target, params = []) {
  const abi = BEP20.find((item) => item.type === "function" && item.name === method);

  return singleCall({
    web3: BSC_WEB3,
    limiter: BSC_LIMITER,
    target,
    abi,
    params,
  });
}

// eslint-disable-next-line no-unused-vars
async function cdp(endpoint, options) {
  return "TODO";
}

module.exports = {
  abi: {
    call: ({ target, abi, block, params }) => {
      if (typeof abi === "string") {
        abi = getCachedFunction(abi);
      }
      debug("bsc.api.abi.call", { target, abi, block, params });

      return singleCall({ web3: BSC_WEB3, limiter: BSC_LIMITER, target, abi, block, params });
    },
    multiCall: ({ target, abi, block, calls }) => {
      if (typeof abi === "string") {
        abi = getCachedFunction(abi);
      }
      debug("bsc.api.abi.multiCall", { target, abi, block, calls });

      return multiCall({ multiCallProvider: multiCallProvider, limiter: BSC_LIMITER, target, abi, block, calls });
    },
  },
  cdp: {
    getAssetsLocked: (options) =>
      cdp("getAssetsLocked", { ...options, chunk: { param: "targets", length: 1000, combine: "balances" } }),
  },
  util: {
    getLogs: ({ target, topic, keys, fromBlock, toBlock }) => {
      debug("bsc.api.util.getLogs", { target, topic, fromBlock, toBlock });

      return getLogs({
        web3: BSC_WEB3,
        scan: BSC_SCAN,
        limiter: BSC_LIMITER,
        target,
        topic,
        keys,
        fromBlock,
        toBlock,
      });
    },
    tokenList: () => {
      debug("bsc.api.util.tokenList");

      return Promise.resolve(tokenList);
    },
    toSymbols: (addressesBalances) => {
      debug("bsc.api.util.toSymbols", addressesBalances);

      return Promise.resolve({
        callCount: 0,
        output: toSymbols(addressesBalances),
      });
    },
  },
  bnb: {
    getBalance: async ({ target, block, decimals }) => {
      debug("bsc.api.bnb.getBalance", { target, block, decimals });

      let { callCount, output } = await getBalance({
        web3: BSC_WEB3,
        limiter: BSC_LIMITER,
        target,
        block,
      });

      if (decimals) {
        output = new BigNumber(output).dividedBy(new BigNumber(10).exponentiatedBy(new BigNumber(decimals))).toString();
      }

      return { callCount, output };
    },
    getBalances: async ({ targets, block, decimals }) => {
      debug("bsc.api.bnb.getBalances", { targets, block, decimals });

      let { callCount, output } = await getBalances({
        web3: BSC_WEB3,
        limiter: BSC_LIMITER,
        targets,
        block,
      });

      if (decimals) {
        output = output.map((o) =>
          new BigNumber(o).dividedBy(new BigNumber(10).exponentiatedBy(new BigNumber(decimals))).toString()
        );
      }

      return { callCount, output };
    },
  },
  bep20: {
    info: async (target) => {
      debug("bsc.api.bep20.info", { target });

      const { callCount: symbolCallCount, output: symbol } = await bep20("symbol", target);
      const { callCount: decimalsCallCount, output: decimals } = await bep20("decimals", target);

      return {
        callCount: symbolCallCount + decimalsCallCount,
        output: {
          symbol,
          decimals: parseInt(decimals),
        },
      };
    },
    symbol: (target) => {
      debug("bsc.api.bep20.symbol", { target });

      return bep20("symbol", target);
    },
    decimals: async (target) => {
      debug("bsc.api.bep20.decimals", { target });

      const { callCount: decimalsCallCount, output: decimals } = await bep20("decimals", target);
      return {
        callCount: decimalsCallCount,
        output: parseInt(decimals),
      };
    },
    totalSupply: async ({ target, block, decimals }) => {
      debug("bsc.api.bep20.totalSupply", { target, block, decimals });

      let { callCount, output } = await bep20("totalSupply", target);

      if (decimals) {
        output = new BigNumber(output).dividedBy(new BigNumber(10).exponentiatedBy(new BigNumber(decimals))).toString();
      }

      return { callCount, output };
    },
    balanceOf: async ({ target, owner, block, decimals }) => {
      debug("bsc.api.bep20.balanceOf", { target, owner, block, decimals });

      let { callCount, output } = await bep20("balanceOf", target, [owner]);

      if (decimals) {
        output = new BigNumber(output).dividedBy(new BigNumber(10).exponentiatedBy(new BigNumber(decimals))).toString();
      }

      return { callCount, output };
    },
  },
};
