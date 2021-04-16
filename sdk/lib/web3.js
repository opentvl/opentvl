const utils = require("web3-utils");
const _ = require("underscore");
const { ethers } = require("ethers");
const debug = require("debug")("web3");

// eslint-disable-next-line no-unused-vars
async function getBalance({ web3, limiter, target, block }) {
  debug("getBalance", target);

  // ignore block since it requires archive nodes
  const rateLimitedGetBalance = limiter.wrap(web3.getBalance);

  const balance = await rateLimitedGetBalance(target);

  return {
    callCount: 1,
    output: balance,
  };
}

// eslint-disable-next-line no-unused-vars
async function getBalances({ web3, limiter, block, targets }) {
  debug("getBalances", targets);

  // ignore block since it requires archive nodes
  const rateLimitedGetBalance = limiter.wrap(web3.getBalance);

  const balances = await Promise.all(targets.map((target) => rateLimitedGetBalance(target)));

  return {
    callCount: targets.length,
    output: balances,
  };
}

async function getLogs({ web3, scan, limiter, target, topic, keys = [], fromBlock, toBlock }) {
  debug("getLogs", target, topic, keys, fromBlock, toBlock);

  // assume scattered events can be returned in one page
  // TODO we may need to avoid this assumption
  // and add pagination support at some point
  const txs = await scan.getTxList({ address: target, startBlock: fromBlock, endBlock: toBlock });

  debug("found txs count", txs.length);

  const blocks = txs.reduce((acc, tx) => {
    if (!acc.includes(tx.blockNumber)) {
      acc.push(tx.blockNumber);
    }

    return acc;
  }, []);

  debug("found unique block ids", blocks.length);

  const rateLimitedGetPastLogs = limiter.wrap(web3.getPastLogs);

  const allLogRequests = await Promise.all(
    blocks.map(async (block) => {
      const logs = await rateLimitedGetPastLogs({
        fromBlock: block,
        toBlock: block,
        address: target,
        topics: [utils.sha3(topic)],
      });

      debug("GetPastLogs for block", block);

      return logs;
    })
  );

  const allLogs = allLogRequests.reduce((acc, logs) => {
    return acc.concat(logs);
  }, []);

  debug("found log count", allLogs.length);

  if (keys && keys.length > 0) {
    debug("return with keys", keys);

    return allLogs.map((log) => {
      if (keys.length === 1) {
        return log[keys[0]];
      } else {
        const filteredLog = {};
        for (const key of keys) {
          filteredLog[key] = log[key];
        }
        return filteredLog;
      }
    });
  }

  debug("return with no keys");

  return {
    callCount: allLogRequests.length,
    output: allLogs,
  };
}

async function callOne(web3, abi, target, params) {
  const contract = new web3.Contract([abi], target); // arg.target || target);
  const functionSignature = web3.abi.encodeFunctionSignature(abi);
  const method = contract.methods[functionSignature];

  // IDEALLY const result = await method(...(params || [])).call(undefined, block);
  // REALITY since only archive nodes support call with specific block number
  // and because archive nodes are expensive
  // here we just intentionally request without block
  //
  // the consequence is that we can only get accurate tvl at latest block id

  // debug("callOne", abi.name, target, params, result);
  params = params !== undefined ? (Array.isArray(params) ? params : [params]) : [];
  const result = await method(...params).call();

  return result;
}

async function singleCall({ web3, limiter, target, abi, block, params }) {
  debug("singleCall", target, abi.name, block, params);

  const rateLimitedCallOne = limiter.wrap(callOne);

  const result = await rateLimitedCallOne(web3, abi, target, params);

  return { callCount: 1, output: result };
}

async function multiCall({ multiCallProvider, limiter, target, abi, block, calls }) {
  debug("multiCall", target, abi.name, block, calls);

  if (calls.length === 0) return [];
  const templateContract = new ethers.Contract(calls[0]?.target ?? target ?? "", [abi], multiCallProvider);
  const callChunks = _.chunk(calls, 400);

  const rateLimitedCallChunk = limiter.wrap(async (callChunk) => {
    return await Promise.allSettled(
      callChunk.map((call) => {
        const contract = templateContract.attach(call.target ?? target ?? "");
        const params = call.params !== undefined ? (Array.isArray(call.params) ? call.params : [call.params]) : [];
        const resultPromise = contract[abi.name ?? ""](...params, {
          blockTag: block,
        });
        return resultPromise;
      })
    );
  });

  const result = (await Promise.all(callChunks.map(async (callChunk) => await rateLimitedCallChunk(callChunk)))).flat();

  if (result.filter((t) => t.status === "rejected").length === result.length) {
    throw new Error("Decoding failed");
  }
  const mappedResults = calls.map((call, i) => {
    let output;
    if (result[i].status === "fulfilled") {
      if (utils.isBigNumber(result[i].value)) {
        output = result[i].value.toString();
      } else {
        output = result[i].value;
      }
    } else {
      output = undefined;
    }
    return {
      input: {
        target: call.target ? call.target : target ? target : "",
        params: call.params ? (Array.isArray(call.params) ? call.params : [call.params]) : [],
      },
      success: result[i].status === "fulfilled",
      output: output,
    };
  });
  return { callCount: Math.ceil(calls.length / 400), output: mappedResults };
}

module.exports = {
  getBalance,
  getBalances,
  getLogs,
  singleCall,
  multiCall,
};
