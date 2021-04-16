const express = require("express");
const { readdir } = require("fs").promises;
const sdk = require("./sdk");

const app = express();
const port = 7890;

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

    const { tvl } = require(`./projects/${project}/index.js`);

    const output = await tvl(0, 9999999999);

    const outputWithSymbolKeys = await sdk.bsc.api.util.toSymbols(output);

    console.log("Final Result", output, outputWithSymbolKeys);

    res.json(JSON.stringify(outputWithSymbolKeys));
  } catch (err) {
    console.log("project processing error", err);

    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`TVL Server listening at http://localhost:${port}`);
});
