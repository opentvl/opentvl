function checkFile(file) {
  console.log(`processing file ${file}`);
  const list = require(file);

  let dup = 0;

  for (let i = 0; i < list.length - 1; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (list[i].symbol.toLowerCase() === list[j].symbol.toLowerCase()) {
        dup += 1;
        console.log(`found duplicated symbol`, list[i], list[j]);
      }
    }
  }

  console.log(`found ${dup} duplicated symbol for file ${file}`);
}

function main() {
  checkFile("../sdk/data/bscTokenLists.json");
  checkFile("../sdk/data/ethTokenLists.json");
  checkFile("../sdk/data/hecoTokenLists.json");
}

main();
