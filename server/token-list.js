const _ = require("underscore");
const sdk = require("../sdk");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { parse } = require("node-html-parser");
const debug = require("debug")("opentvl:server:token-list");

const DECIMALS_ABI = {
  constant: true,
  inputs: [],
  name: "decimals",
  outputs: [
    {
      name: "",
      type: "uint8"
    }
  ],
  payable: false,
  stateMutability: "view",
  type: "function"
};

const CHAINS = [
  {
    file: "bscTokenLists.json",
    scanUrl: "https://bscscan.com",
    multiCall: sdk.bsc.abi.multiCall
  },
  {
    file: "ethTokenLists.json",
    scanUrl: "https://etherscan.io",
    multiCall: sdk.eth.abi.multiCall
  },
  {
    file: "hecoTokenLists.json",
    scanUrl: "https://hecoinfo.com",
    multiCall: sdk.heco.abi.multiCall
  }
];

function extractSymbol(name) {
  return name.slice(name.indexOf("(") + 1, name.indexOf(")"));
}

function extractAddress(link) {
  return link.slice(link.indexOf("/token/") + 7);
}

async function fetchPage(scanUrl, page) {
  const html = await (await fetch(`${scanUrl}/tokens?ps=100&p=${page}`)).text();

  const root = parse(html);
  const table = root.querySelector("#tblResult");

  if (!table) {
    return [];
  }

  const tableRows = table.querySelectorAll("tbody tr");

  const tokens = tableRows.reduce((acc, row, idx) => {
    const title = row.querySelector(".text-primary");

    const symbol = extractSymbol(title.innerHTML);
    const contract = extractAddress(title.getAttribute("href"));

    acc.push({
      symbol,
      contract,
      rank: (page - 1) * 100 + idx + 1
    });

    return acc;
  }, []);

  return tokens;
}

async function saveTokenLists(directory) {
  for (let chain of CHAINS) {
    const file = path.join(directory, chain.file);

    // fetch up to 1000 tokens
    const pageTokens = await Promise.all(_.range(1, 11).map(page => fetchPage(chain.scanUrl, page)));

    const allTokens = pageTokens.flat();

    const decimals = (
      await chain.multiCall({ abi: DECIMALS_ABI, calls: allTokens.map(t => ({ target: t.contract })) })
    ).output.map(o => o.output);

    const updatedTokens = allTokens.reduce((acc, t, idx) => {
      // ignore tokens with no valid decimal
      if (decimals[idx]) {
        acc.push({ ...t, decimals: decimals[idx] });
      }

      return acc;
    }, []);

    fs.writeFileSync(file, JSON.stringify(updatedTokens, null, 2));

    debug(`saved total ${updatedTokens.length} tokens to ${file}`);
  }
}

module.exports = { saveTokenLists };
