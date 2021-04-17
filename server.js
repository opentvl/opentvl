const Eth = require("web3-eth");
const express = require("express");
const { readdir } = require("fs").promises;
const sdk = require("./sdk");

const app = express();
const port = 7890;

if (!process.env.BSC_RPC_URL) {
  throw new Error(`Please set environment variable BSC_RPC_URL`);
}

if (!process.env.ETH_RPC_URL) {
  throw new Error(`Please set environment variable ETH_RPC_URL`);
}

const BSC_WEB3 = new Eth(process.env.BSC_RPC_URL);
const ETH_WEB3 = new Eth(process.env.ETH_RPC_URL);

async function hasProject(project) {
  const projectNames = await readdir("projects");

  return projectNames.some(name => name === project);
}

app.get("/projects/:project", async (req, res) => {
  try {
    const project = req.params.project;

    if (!(await hasProject(project))) {
      res.status(400).json(JSON.stringify({ error: `unknown project ${project}` }));

      return;
    }

    const { tvl, version } = require(`./projects/${project}/index.js`);

    const ethBlock = await ETH_WEB3.getBlockNumber();
    const bscBlock = await BSC_WEB3.getBlockNumber();

    let block = {
      eth: ethBlock,
      bsc: bscBlock
    };

    if (!version) {
      // to keep compatibility with old adapters
      // we introduced a version field
      // new adapters should expect block to be an object of { eth, bsc }
      block = ethBlock;
    }

    let output = await tvl(0, block);

    if (!version) {
      // to keep compatibility with old adapters
      // new adapters should handle toSymbols inside the adapters themselves
      output = (await sdk.eth.util.toSymbols(output)).output;
    }

    console.log("Final Result", output);

    res.json(JSON.stringify(output));
  } catch (err) {
    console.log("project processing error", err);

    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`TVL Server listening at http://localhost:${port}`);
});
