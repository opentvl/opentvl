const utils = require("web3-utils");
const _ = require("underscore");
const debug = require("debug")("opentvl:web3");
const MULTICALL = require("../abis/multicall.json");
const MULTICALL_CHUNK_SIZE = 400;

async function getBalance({ web3, limiter, target }) {
  debug("getBalance", target);

  // ignore block since it requires archive nodes
  const rateLimitedGetBalance = limiter.wrap(web3.getBalance);

  const balance = await rateLimitedGetBalance(target);

  return {
    callCount: 1,
    output: balance
  };
}

async function getBalances({ web3, limiter, targets }) {
  debug("getBalances", targets);

  // ignore block since it requires archive nodes
  const rateLimitedGetBalance = limiter.wrap(web3.getBalance);

  const balances = await Promise.all(
    targets.map(async target => {
      const balance = await rateLimitedGetBalance(target);

      return { target, balance };
    })
  );

  return {
    callCount: targets.length,
    output: balances
  };
}

// group blocks into group ranges which covers all the numbers
function groupBlocks(blockIds, batchSize) {
  if (blockIds.length < 2) {
    return blockIds;
  }

  const sortedIds = blockIds.sort((i1, i2) => i1 - i2);

  let groupStart = sortedIds[0];
  let groups = [];

  for (let i = 1; i < sortedIds.length; i++) {
    if (sortedIds[i] > groupStart + batchSize) {
      groups.push([groupStart, sortedIds[i - 1]]);

      groupStart = sortedIds[i];
    }
  }

  groups.push([groupStart, sortedIds[sortedIds.length - 1]]);

  return groups;
}

async function getScanTxs({ scan, target, fromBlock, toBlock }) {
  // assume scattered events can be returned in one page
  // TODO we may need to avoid this assumption
  // and add pagination support at some point
  const [externalTxs, internalTxs] = await Promise.all([
    await scan.getTxList({ address: target, startBlock: fromBlock, endBlock: toBlock }),
    await scan.getTxListInternal({ address: target, startBlock: fromBlock, endBlock: toBlock })
  ])

  debug("found external txs count", externalTxs.length);
  debug("found internal txs count", internalTxs.length);
  debug("found total txs count", [...externalTxs, ...internalTxs].length);

  return [externalTxs, internalTxs];
}

function generateScanGroups({ txs, batchSize }) {
  const blocks = txs.reduce((acc, tx) => {
    const height = parseInt(tx.blockNumber, 10);

    if (!acc.includes(height)) {
      acc.push(height);
    }

    return acc;
  }, []);

  debug("found unique block ids", blocks.length);

  const blockGroups = groupBlocks(blocks, batchSize);

  debug("arranged into groups", blockGroups.length);

  return blockGroups;
}

function generateNaiveGroups(fromBlock, toBlock, batchSize) {
  const groups = [];

  for (let i = fromBlock; i <= toBlock; i += batchSize) {
    groups.push([i, Math.min(toBlock, i + batchSize - 1)]);
  }

  return groups;
}

async function retryGetGroupLogs({ address, topics, fromBlock, toBlock, getPastLogs }) {
  const numTries = 5;
  let numTriesLeft = numTries;
  let ranges = [[fromBlock, toBlock]];

  while (numTriesLeft > 0) {
    try {
      const logs = (
        await Promise.all(
          ranges.map(async ([fromBlock, toBlock]) => {
            return await getPastLogs({
              fromBlock,
              toBlock,
              address,
              topics
            });
          })
        )
      ).flat();

      debug(`GetPastLogs from block ${fromBlock} to ${toBlock}`);

      return [numTries - numTriesLeft + 1, logs];
    } catch (err) {
      ranges = ranges.reduce((acc, [fromBlock, toBlock]) => {
        if (fromBlock === toBlock) {
          acc.push([fromBlock, toBlock]);
        } else {
          const midBlock = Math.floor((fromBlock + toBlock) / 2);

          acc.push([fromBlock, midBlock]);
          acc.push([midBlock + 1, toBlock]);
        }

        return acc;
      }, []);

      numTriesLeft -= 1;
    }
  }

  debug(`GetPastLogs failed from block ${fromBlock} to ${toBlock}`);
  return [numTries, []];
}

async function getLogs({ web3, scan, limiter, batchSize, target, topic, topics, keys = [], fromBlock, toBlock }) {
  debug("getLogs", target, topic, keys, fromBlock, toBlock);

  const [externalTxs, internalTxs] = await getScanTxs({ scan, target, fromBlock, toBlock });

  const groups = externalTxs.length >= 10000 || internalTxs.length >= 10000 ? (
    generateNaiveGroups(fromBlock, toBlock, batchSize)
  ) : (
    generateScanGroups({ txs: [...externalTxs, ...internalTxs], batchSize })
  )

  const rateLimitedGetPastLogs = limiter.wrap(web3.getPastLogs);

  let callCount = 0;
  const allLogRequests = await Promise.all(
    groups.map(async ([fromBlock, toBlock]) => {
      const [numCalls, logs] = await retryGetGroupLogs({
        fromBlock,
        toBlock,
        address: target,
        topics: topics || [utils.sha3(topic)],
        getPastLogs: rateLimitedGetPastLogs
      });

      callCount += numCalls;
      return logs;
    })
  );

  const allLogs = allLogRequests.reduce((acc, logs) => {
    return acc.concat(logs);
  }, []);

  debug("found log count", allLogs.length);

  if (keys && keys.length > 0) {
    debug("return with keys", keys);

    return {
      callCount,
      output: allLogs.map(log => {
        if (keys.length === 1) {
          return log[keys[0]];
        } else {
          return keys.reduce((acc, key) => {
            acc[key] = log[key];
            return acc;
          }, {});
        }
      })
    };
  }

  debug("return with no keys");

  return {
    callCount: allLogRequests.length,
    output: allLogs
  };
}

function normalizeCallParams(params) {
  if (params === undefined) {
    return [];
  }

  if (Array.isArray(params)) {
    return params;
  }

  return [params];
}

async function callOne(web3, abi, target, params) {
  const contract = new web3.Contract([abi], target);
  const functionSignature = web3.abi.encodeFunctionSignature(abi);
  const method = contract.methods[functionSignature];

  // IDEALLY const result = await method(...(params || [])).call(undefined, block);
  // REALITY since only archive nodes support call with specific block number
  // and because archive nodes are expensive
  // here we just intentionally request without block
  //
  // the consequence is that we can only get accurate tvl at latest block id

  // debug("callOne", abi.name, target, params, result);
  const result = await method(...normalizeCallParams(params)).call();

  return result;
}

async function singleCall({ web3, limiter, target, abi, block, params }) {
  debug("singleCall", target, abi.name, block, params);

  const rateLimitedCallOne = limiter.wrap(callOne);

  const result = await rateLimitedCallOne(web3, abi, target, params);

  return { callCount: 1, output: result };
}

async function multiCall({ web3, multiCallProvider, limiter, target, abi, block, calls }) {
  debug("multiCall", target, abi.name, block, calls);

  if (calls.length === 0) return { callCount: 0, output: [] };

  const multiCallContract = new web3.Contract(MULTICALL, multiCallProvider);

  const rateLimitedCallChunk = limiter.wrap(async callChunk => {
    const txs = callChunk.map(call => ({
      delegateCall: false,
      revertOnError: false,
      gasLimit: 0,
      target: call.target || target,
      value: 0,
      data: web3.abi.encodeFunctionCall(abi, normalizeCallParams(call.params))
    }));

    const response = await multiCallContract.methods.multiCall(txs).call();

    return response._results.map((res, idx) => {
      const input = {
        target: callChunk[idx].target || target,
        params: normalizeCallParams(callChunk[idx].params)
      };

      try {
        const callResult = web3.abi.decodeParameters(abi.outputs, res);

        return {
          input,
          success: response._successes[idx],
          // according to SDK doc, if there's only one, return result directly
          output: abi.outputs.length === 1 ? callResult[0] : callResult
        };
      } catch (decodeErr) {
        console.log("decode err", abi.name, callChunk[idx].target || target, callChunk[idx].params, decodeErr.message);

        return {
          input,
          success: false,
          output: null
        };
      }
    });
  });

  const callChunks = _.chunk(calls, MULTICALL_CHUNK_SIZE);

  const responses = (
    await Promise.all(callChunks.map(async callChunk => await rateLimitedCallChunk(callChunk)))
  ).flat();

  // debug("Multicall Result", responses);

  return { callCount: callChunks.length, output: responses };
}

module.exports = {
  getBalance,
  getBalances,
  getLogs,
  singleCall,
  multiCall
};
