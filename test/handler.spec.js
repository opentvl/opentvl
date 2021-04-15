const { api } = require("../sdk/");

test("fortube", async () => {
  const project = "fortube";
  const { tvl } = require(`../projects/${project}/index.js`);
  const output = await tvl(0, 12247364);
  const outputWithSymbolKeys = await api.util.toSymbols(output);
  console.log(outputWithSymbolKeys);
}, 1000000);
