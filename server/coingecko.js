const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const debug = require("debug")("opentvl:server:coingecko");

async function getProjects() {
  const projectsRes = await fetch(`https://api.coingecko.com/api/v3/coins/list?include_platform=true`);

  if (!projectsRes.ok) {
    throw new Error(`error fetching projects from coingecko`);
  }

  return await projectsRes.json();
}

async function saveCoingeckoProjects(directory) {
  const projects = await getProjects();

  const filePath = path.join(directory, "coinGeckoIDs.json");

  debug(`saved ${projects.length} coingecko projects to ${filePath}`);

  fs.writeFileSync(filePath, JSON.stringify(projects, undefined, 2));
}

module.exports = { saveCoingeckoProjects };
