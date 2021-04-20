const MultiCallUtils = artifacts.require("MultiCallUtils");

module.exports = async function (deployer, network, accounts) {
  try {
    await deployer.deploy(MultiCallUtils, {
      from: accounts[0]
    });

    console.log("MultiCallUtils deployed");
  } catch (e) {
    console.log("Error deploy", e);
  }
};
