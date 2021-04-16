const { multiCall } = require("./web3");
const BigNumber = require("bignumber.js");

async function toSymbols(addresses) {
  const queryAddresses = Object.keys(addresses).filter((t) => t !== "0x0000000000000000000000000000000000000000");
  const symbols = (
    await multiCall({
      abi: "erc20:symbol",
      calls: queryAddresses.map((t) => {
        return { target: t };
      }),
    })
  ).reduce(
    (m, t) => {
      m[t.input.target] = t.output;
      return m;
    },
    {
      "0x0000000000000000000000000000000000000000": "BNB",
    }
  );
  const decimals = (
    await multiCall(
      "erc20:decimals",
      queryAddresses.map((t) => {
        return { target: t };
      })
    )
  ).reduce(
    (m, t) => {
      m[t.input.target] = t.output;
      return m;
    },
    { "0x0000000000000000000000000000000000000000": 18 }
  );

  const result = Object.keys(addresses).reduce((m, t) => {
    m[symbols[t]] = new BigNumber(addresses[t])
      .dividedBy(new BigNumber(10).exponentiatedBy(new BigNumber(decimals[t])))
      .toString();
    return m;
  }, {});
  return result;
}

module.exports = { toSymbols };
