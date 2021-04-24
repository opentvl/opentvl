const _ = require("underscore");
const sdk = require("../sdk");
const fs = require("fs");
const fetch = require("node-fetch");
const { parse } = require("node-html-parser");

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
    file: "../sdk/data/bscTokenLists.json",
    scanUrl: "https://bscscan.com",
    multiCall: sdk.bsc.abi.multiCall
  },
  {
    file: "../sdk/data/ethTokenLists.json",
    scanUrl: "https://etherscan.io",
    multiCall: sdk.eth.abi.multiCall
  },
  {
    file: "../sdk/data/hecoTokenLists.json",
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

  const tokens = tableRows.reduce((acc, row) => {
    const title = row.querySelector(".text-primary");

    const symbol = extractSymbol(title.innerHTML);
    const contract = extractAddress(title.getAttribute("href"));

    acc.push({
      symbol,
      contract
    });

    return acc;
  }, []);

  return tokens;
}

async function updateTokenLists() {
  for (let chain of CHAINS) {
    console.log(`start updating ${chain.file}`);

    // fetch up to 1000 tokens
    const pageTokens = await Promise.all(_.range(1, 11).map(page => fetchPage(chain.scanUrl, page)));

    const allTokens = pageTokens.flat();
    const existingTokens = require(chain.file);

    existingTokens.forEach(token => {
      const hasToken = allTokens.some(t => t.contract === token.contract);

      if (!hasToken) {
        allTokens.push(token);
      }
    });

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

    fs.writeFileSync(chain.file, JSON.stringify(updatedTokens, null, 2));

    console.log(`done updating ${chain.file}, total ${updatedTokens.length} tokens`);
  }
}

updateTokenLists().catch(console.error);
