const fetch = require('node-fetch');

const url = 'https://raw.githubusercontent.com/pancakeswap/pancake-frontend/develop/src/config/constants/pools.ts'

async function getSyrupPools() {
  const file = await (await fetch(url)).text();
  const lines = file.split('\n');
  const addresses = lines.reduce((acc, line) => {
    if (line.trim().startsWith('56')) {
      const address = line.split(': ')[1].slice(1,-2);
      acc.push(address);
    }

    return acc;
  }, []);

  console.log(JSON.stringify(addresses, undefined, 2));
}

getSyrupPools();