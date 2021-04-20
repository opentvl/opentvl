const { ArgumentParser } = require("argparse");
const fs = require("fs/promises");
const path = require("path");

(async () => {
  const parser = new ArgumentParser({
    description: "Convert array ABI to object ABI",
  });

  parser.add_argument("sourceABIFile", { help: "The source path of the ABI file" });
  parser.add_argument("--dest", {
    help: "The destination path of the generated object ABI file, default to source.new.json",
  });
  const args = parser.parse_args();

  const arrayABI = JSON.parse(await fs.readFile(args.sourceABIFile, "utf-8"));
  const objectABI = arrayABI.reduce((prev, curr) => {
    if (curr.name) {
      prev[curr.name] = curr;
    }
    return prev;
  }, {});

  let destABIFile;
  if (args.destABIFile) {
    destABIFile = args.destABIFile;
  } else {
    const dir = path.dirname(args.sourceABIFile);
    const extension = path.extname(args.sourceABIFile);
    const file = path.basename(args.sourceABIFile, extension);
    destABIFile = path.join(dir, `${file}.new${extension}`);
  }

  await fs.writeFile(destABIFile, JSON.stringify(objectABI), "utf-8");
})();
