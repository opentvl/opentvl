require("dotenv").config();

const Eth = require("web3-eth");
const express = require("express");
const path = require("path");
const { readdir, mkdir } = require("fs").promises;
const { existsSync } = require("fs");
const debug = require("debug")("opentvl:server");
const { savePriceFeeds } = require("./chainlink");
const { saveTokenLists } = require("./token-list");
const computeTVLUSD = require("./tvl-usd");

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

const DATABASE_PATH = path.join(__dirname, "..", ".database");

async function refreshDatabase() {
  debug("updating database");

  if (!existsSync(DATABASE_PATH)) {
    await mkdir(DATABASE_PATH);
  }

  await savePriceFeeds(DATABASE_PATH);
  await saveTokenLists(DATABASE_PATH);
}

async function hasProject(project) {
  const projectNames = await readdir("projects");

  return projectNames.some(name => name === project);
}

async function fetchTVL(project) {
  const { tvl, version } = require(`../projects/${project}/index.js`);

  debug("found tvl adapter version", version);

  const ethBlock = await ETH_WEB3.getBlockNumber();
  const bscBlock = await BSC_WEB3.getBlockNumber();

  let block = {
    eth: ethBlock,
    bsc: bscBlock
  };

  debug("running tvl with block", block);

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

    // some old adapters returns upper case addresses
    output = Object.keys(output).reduce((acc, addr) => {
      acc[addr.toLowerCase()] = output[addr];
      return acc;
    }, {});

    output = { eth: output };
  }

  debug("found tvl in symbols", JSON.stringify(output, null, 2));

  return output;
}

app.get("/projects/:project", async (req, res) => {
  const startedAt = Date.now();

  try {
    const project = req.params.project;

    debug("received request for project", project);

    if (!(await hasProject(project))) {
      res.status(400).json(JSON.stringify({ error: `unknown project ${project}` }));

      return;
    }

    const output = await fetchTVL(project);

    debug("final result", output);
    debug(`total processing time ${Date.now() - startedAt}ms`);

    res.json(output);
  } catch (err) {
    console.log("project processing error", err);

    res.status(500).json({ error: err.message });
  }
});

app.get("/projects/:project/tvl_by_usd", async (req, res) => {
  const startedAt = Date.now();

  try {
    const project = req.params.project;

    debug("received request for project", project);

    if (!(await hasProject(project))) {
      res.status(400).json(JSON.stringify({ error: `unknown project ${project}` }));

      return;
    }

    const output = await fetchTVL(project);

    const tvlUSD = await computeTVLUSD(output);

    debug("final result", tvlUSD);
    debug(`total processing time ${Date.now() - startedAt}ms`);

    res.json({ USD: tvlUSD });
  } catch (err) {
    console.log("project processing error:", err);

    res.status(500).json({ error: err.message });
  }
});

app.get("/health", async (req, res) => {
  res.json({ status: "HEALTHY" });
});

refreshDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`TVL Server listening at http://localhost:${port}`);
    });

    // refresh database every 5 mins
    setInterval(() => {
      refreshDatabase().catch(err => {
        console.error("refreshDatabase error", err);
      });
    }, 5 * 60 * 1000);
  })
  .catch(err => {
    console.error("refreshDatabase error", err);
  });
