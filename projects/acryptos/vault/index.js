/*==================================================
  Modules
  ==================================================*/

const sdk = require("../../../sdk");
const vaultAbi = require("./vaultAbi");
const lpAbi = require("./lpAbi");
const _ = require("underscore");
const BigNumber = require("bignumber.js");
const assert = require("assert").strict;

/*==================================================
  Settings
  ==================================================*/

// source: https://app.acryptos.com/contracts/, regex: '([\-\w ]+)\nVault: (0x[\w\d]+)'
let vaultAddresses = [
  "0x7679381507af0c8DE64586A458161aa58D3A4FC3", // ACS Vault
  "0x6Fe6762E9314ad80803fef083c8bB16Af435a628", // BNB Vault
  "0x0395fCC8E1a1E30A1427D4079aF6E23c805E3eeF", // BTC Vault
  "0x35cAdD2DAA782556B7fD90A98663BaCDb78d863e", // ETH Vault
  "0x883A0D28dbac2E713e87aa2448595438D8016811", // VAI Vault
  "0x532d5775cE71Cb967B78acbc290f80DF80A9bAa5", // BUSD Vault
  "0x32Fe1bE67102c10F6f5E798cb24723E738A31943", // USDT Vault
  "0xA4964271b476B0730Acf86DD9f8D270b5E804126", // DAI Vault
  "0x4E58b693092e33e46A8734B9c4064B82afdcA14f", // USDC Vault
  "0xFc698dAE6c5B7e38F8Eb8Fc240f23c598d17e5e2", // SXP Vault
  "0xB1Dc4FEe3248362d54E15192EA771E82dfafd5Bd", // XVS Vault
  "0x7abbCf9Ac11f65955be8e93Ed7ed64B12E34a58E", // LTC Vault
  "0xE0303c65fc9Ce79c53228aE1E8cde3b6b8c02F95", // DOT Vault
  "0x161Afe47561CfCF9603Ef67C44de95114e78D33F", // LINK Vault
  "0xbB08f867dB0FDA40083D7636ef18bB88e592CC1b", // ADA Vault
  "0x90F277c402Ea280E70068049fAb1d123bB6CBA16", // XRP Vault
  "0x03E904a729A6E0eB4B675969D3fe51b5392f5C39", // BETH Vault
  "0xB6eB654FBDc697edD73174a19B074BC67c00a0C0", // CAKE Vault
  "0x2b66399AD01be47C5aa11C48fDd6DF689DAE929A", // ACSI Vault
];
// pancake v1 swap vault
let swapVaultV1Addresses = [
  "0xb00B62da1cd28AB88983960487F2902c64c00bc5", // sACS-SXP Vault
  "0x03f52C3612df0dB3c86a4776a20caece8A194f38", // sVAI-BNB Vault
  "0x1DA371DC8127b0cdED8D13fF20F062Bb9e02C1a3", // sSXP-BNB Vault
  "0x49C4b95dc2198F2c4c9516834a8AcBFc4b3e4429", // sSXP-BUSD Vault
  "0x2C39de04688D71Cd7d502297dEf53E4be0c420B3", // sSXP-BTC Vault
  "0x68fdCd299E33Bee7695eFBc227Ab948Ae29BFc3c", // CAKE-BNB Vault
  "0xcd630D39F76C12Af11c2Ed9876ccF976C47A08C3", // XVS-BNB Vault
  "0xFd1EfbAe73E0BAF23fB0Fb394480405609B331b6", // SXP-BNB Vault
  "0x97391c2A035bdCF537c1ce2a70D14fAA3d44317f", // BUSD-BNB Vault
  "0xA0753CC49EB66bb4Bc80E8f042A6dE21fc03e5cD", // USDT-BNB Vault
  "0xCfbB1A0522e70fA5688c023b37C58e43c9A6398E", // USDT-BUSD Vault
  "0x51d6b8A1d3f6b4aEf8bcaECD8EaD7ff2EFDcbB73", // ETH-BNB Vault
  "0x161A623c27D20d3717ffe279889e50eEb23962c3", // BTC-BNB Vault
  "0x1B5ca4cBf6a2f453506fEC365dc0061d8D127Ec9", // pBTC-BNB Vault
  "0x15edF148b5d43684075B77EEa866FF833a54d73c", // LTC-BNB Vault
  "0x55D2AE06B0904d70d091BC32608F37C5FBE375D4", // YFI-BNB Vault
  "0xDAC0c9b3CaccF7e76D2F238663c98fDd9D07F323", // ADA-BNB Vault
  "0xed08BD00c24197f696A58CAdb3Bca9c67d8110A7", // UNI-BNB Vault
  "0xEC94dC055d478C97E7C434dd6BC34eAb1c527aB3", // DOT-BNB Vault
  "0x8419Ef10edF92d649C9C2c61D3920e31760d7dec", // LINK-BNB Vault
  "0xA20806fB4fC6dC3434Bba7a8587f0efEB0e69584", // BAND-BNB Vault
  "0xD7d38dBcC1cF9DF5f644b23eB19DdeA17105ec25", // ZIL-BNB Vault
  "0xeF015F747dC06672501Ff0F20c3b94F56FA5427F", // TKO-BNB Vault
  "0x6200F22041bDA696D3A639aF1ddb62747E384941", // TLM-BNB Vault
  "0xe427a9688C0d16eA5d29DB0dcC1D6E1e61Ea9908", // TWT-BNB Vault
  "0xDB335c7c4AD429A1F53971fd4644b599DC631306", // UNFI-BNB Vault
  "0x93e2e1e384dC298bDEafaEe9751841EA211f2d42", // BTCST-BNB Vault
  "0x02AaBF12f7C377916BB828BcE3d45c778d919d0e", // SFP-BNB Vault
  "0x2932568487318969BE7593a27dD5d45aB521e50D", // FRONT-BNB Vault
  "0xC109d8B9F89Bd939B81Df4Fe47951f9683207102", // WATCH-BNB Vault
  "0x2D8483Bc2a9E2723711888532Fd542483F041137", // SWINGBY-BNB Vault
  "0xa1125B756e0ac05ff5d07Cde4D511E1837aADc88", // ALICE-BNB Vault
  "0x2654346a32D4233B3266AF3C5FD7BAE3C571F345", // FOR-BUSD Vault
  "0xa387beD33E0415302614545eAD370c27778B955E", // TPT-BUSD Vault
  "0x373561f3119353e50F21EE1181dd8749ae8276b9", // MIR-UST Vault
  "0xED51b5c077B71d5B475E30C88B72632fa679fCE3", // COMP-ETH Vault
  "0x3679d4C2752bEef8632fd12c45b005ecB2774EF0", // SUSHI-ETH Vault
  "0xe9d9f54Ab89F712ABBdbb3C0F63f2D6eDAa3869c", // BETH-ETH Vault
];
// pancake v2 swap vault
let swapVaultV2Addresses = [
  "0xe9861F3624B5F7012991ba2762CD1eAD4c622FF5", // CAKE-BNB Vault
  "0x1Db2f258E7f403C1f4b1BC47F686aa3E161DC655", // XVS-BNB Vault
  "0x32d5B8867B44762d78e80fFcBF6E956E6A35F3a0", // SXP-BNB Vault
  "0x9Ce0E88c803672CE672b9b9e66c664B81499cE04", // BUSD-BNB Vault
  "0x54D01f573017A4e61452cb13432e3a59a79C36bf", // USDT-BNB Vault
  "0x08234f020496ccceEB144f9637A566b936b0EE6F", // ETH-BNB Vault
  "0x1231082D043393f8990861521A10BDc911fEDbBe", // BTC-BNB Vault
  "0xC3eF174A704aB413cA81A5eB3f7eB08B535e91C4", // pBTC-BNB Vault
  "0xbe627707f079e32A54d323BE0c61Da02a28bD0bd", // BTC-BUSD Vault
  "0x5e1D648CF00E31b08ede095170B6764B60D06056", // LTC-BNB Vault
  "0xdFE0E5992dE7Ca8277A40C37ACCDE36dCb9c94C6", // YFI-BNB Vault
  "0x3DCd4c706EA3c36a1173503ad5C40217Bfbc935E", // ADA-BNB Vault
  "0xeE9Ccd9d5c8b07Bb9E6bF1Ab17748C737eC35EA0", // UNI-BNB Vault
  "0xB2c1B30689B8A3fD0916B3a3C6135D0226DeCA7c", // DOT-BNB Vault
  "0x67D288C7599F866880e7486F9E29dedA4749bBB8", // XRP-BNB Vault
  "0xB18Cf14cCD6a32C87783c2010D52aB39fA98A081", // LINK-BNB Vault
  "0x2883D6d514D2474B942769B981702526897D74D4", // BAND-BNB Vault
  "0x3d4bECF8C867d0Ca5C40b5c9449b96C481425334", // ZIL-BNB Vault
  "0x22E61e0E445f3a5d2675Cbb20f8c03FA3C55BD95", // TWT-BNB Vault
  "0xE47C98A41Ea2f48C17d6B58420CbCeD5E69F5987", // UNFI-BNB Vault
  "0xB8C134eFAfda61a906B657A19b37B3d733362C98", // BTCST-BNB Vault
  "0x14cb72a422bE17372108A2b5f7A2837297948745", // SFP-BNB Vault
  "0x79980898fB7fCC8950335b173Cc5872A96328b5d", // TKO-BNB Vault
  "0x7d34CD09953E4f30Cb21494A1ee74eb3F03d996a", // TLM-BNB Vault
  "0x5A330d3F99Ac2Ef00ac5167707D88E9D3D59620c", // ALICE-BNB Vault
  "0x8692858d9DAE5C9E48515531E8d62d2c44E4C453", // FRONT-BNB Vault
  "0x8383661eCF333FCe4Bf51d498D7c94e2a0c7d5AF", // WATCH-BNB Vault
  "0xC34E0597e50A173E3bE8682512aff80D0DFd49f9", // SWINGBY-BNB Vault
  "0xcDb35CF4DeD79c991eabcbB03fEcBA6D9af0Bf6e", // ALPHA-BNB Vault
  "0x4c6f2643001669842778D8B6C1878E3EbC1Ea377", // REEF-BNB Vault
  "0x46E65055Be06AF470384BcFe140b4ec8a160d15f", // CTK-BNB Vault
  "0x38e3e6973Ba60daADB3bA8B4DF76Ef3a5A8962b0", // USDT-BUSD Vault
  "0xAd4BBa0Da4889830fa8C9c7B1b04Ab4faa791F6f", // FOR-BUSD Vault
  "0xCbA040A994824572c6827d81A6f5715E163C0F64", // TPT-BUSD Vault
  "0xA7fE1ac962E451312208e09A7c894EBa44833E86", // MIR-UST Vault
  "0x627E6506F26f7ae6250667f4F5A494E0e6443ED5", // COMP-ETH Vault
  "0xCFb96FFbE95C0B7129b57eC4D229F8b9eae2d280", // SUSHI-ETH Vault
];

/*==================================================
  TVL
  ==================================================*/

async function tvlInVault(timestamp, block) {
  const balances = {};
  const vaultToUnderlyingToken = {};

  // Get acryptos' underlying tokens
  const underlyingVaultAddressResults = await sdk.bsc.abi.multiCall({
    calls: _.map(vaultAddresses, (address) => ({
      target: address,
    })),
    abi: vaultAbi["token"],
  });

  _.each(underlyingVaultAddressResults.output, (token) => {
    if (token.success) {
      const underlyingTokenAddress = token.output;
      const vaultAddress = token.input.target;
      vaultToUnderlyingToken[vaultAddress] = underlyingTokenAddress;
      if (!balances[underlyingTokenAddress]) {
        balances[underlyingTokenAddress] = 0;
      }
    }
  });

  // Get acryptos' balances in underlying token
  const vaultBalanceResults = await sdk.bsc.abi.multiCall({
    block,
    calls: _.map(vaultAddresses, (address) => ({
      target: address,
    })),
    abi: vaultAbi["balance"],
  });

  _.each(vaultBalanceResults.output, (tokenBalanceResult) => {
    if (tokenBalanceResult.success) {
      const valueInToken = tokenBalanceResult.output;
      const vaultAddress = tokenBalanceResult.input.target;
      balances[vaultToUnderlyingToken[vaultAddress]] = BigNumber(balances[vaultToUnderlyingToken[vaultAddress]]).plus(
        valueInToken
      );
    }
  });
  return balances;
}

async function tvlInSwapVault(timestamp, block) {
  const balances = {};
  let vaultInfos = {};
  const lpToVault = {};

  const swapVaultAddresses = swapVaultV1Addresses.concat(swapVaultV2Addresses);

  // Get vaults' underlying liquidity pairs' addresses
  const underlyingVaultAddressResults = await sdk.bsc.abi.multiCall({
    calls: _.map(swapVaultAddresses, (address) => ({
      target: address,
    })),
    abi: vaultAbi["token"],
    block: block,
  });
  vaultInfos = underlyingVaultAddressResults.output.reduce((acc, t) => {
    if (t.success) {
      acc[t.input.target] = { lpAddress: t.output };
      assert.ok(lpToVault[t.output] === undefined);
      lpToVault[t.output] = t.input.target;
    }
    return acc;
  }, vaultInfos);

  // Get vaults' balance
  const vaultBalanceResults = await sdk.bsc.abi.multiCall({
    calls: _.map(swapVaultAddresses, (address) => ({
      target: address,
    })),
    abi: vaultAbi["balance"],
    block: block,
  });
  vaultInfos = vaultBalanceResults.output.reduce((acc, t) => {
    acc[t.input.target].balance = t.success ? t.output : 0;
    return acc;
  }, vaultInfos);

  // Get liquidity pairs' underlying token addresses
  const token0Results = await sdk.bsc.abi.multiCall({
    calls: _.map(swapVaultAddresses, (address) => ({
      target: vaultInfos[address].lpAddress,
    })),
    abi: lpAbi["token0"],
    block: block,
  });
  vaultInfos = token0Results.output.reduce((acc, t) => {
    acc[lpToVault[t.input.target]].token0 = t.output;
    if (t.success && !balances[t.output]) {
      balances[t.output] = 0;
    }
    return acc;
  }, vaultInfos);

  const token1Results = await sdk.bsc.abi.multiCall({
    calls: _.map(swapVaultAddresses, (address) => ({
      target: vaultInfos[address].lpAddress,
    })),
    abi: lpAbi["token1"],
    block: block,
  });
  vaultInfos = token1Results.output.reduce((acc, t) => {
    acc[lpToVault[t.input.target]].token1 = t.output;
    if (t.success && !balances[t.output]) {
      balances[t.output] = 0;
    }
    return acc;
  }, vaultInfos);

  // Get liquidity pairs' reserves
  const lpReservesResults = await sdk.bsc.abi.multiCall({
    calls: _.map(swapVaultAddresses, (address) => ({
      target: vaultInfos[address].lpAddress,
    })),
    abi: lpAbi["getReserves"],
    block: block,
  });
  vaultInfos = lpReservesResults.output.reduce((acc, t) => {
    if (t.success) {
      const { 0: reserve0, 1: reserve1 } = t.output;
      acc[lpToVault[t.input.target]].reserve0 = reserve0;
      acc[lpToVault[t.input.target]].reserve1 = reserve1;
    }
    return acc;
  }, vaultInfos);

  // Get liquidity pairs' totalSupply
  const lpTotalSupplyResults = await sdk.bsc.abi.multiCall({
    calls: _.map(swapVaultAddresses, (address) => ({
      target: vaultInfos[address].lpAddress,
    })),
    abi: lpAbi["totalSupply"],
    block: block,
  });
  vaultInfos = lpTotalSupplyResults.output.reduce((acc, t) => {
    acc[lpToVault[t.input.target]].totalSupply = t.output;
    return acc;
  }, vaultInfos);

  // calculate final token balances
  _.each(swapVaultAddresses, (swapVaultAddress) => {
    const { balance, token0, token1, reserve0, reserve1, totalSupply } = vaultInfos[swapVaultAddress];
    const token0Balance = new BigNumber(balance).times(reserve0).div(totalSupply);
    const token1Balance = new BigNumber(balance).times(reserve1).div(totalSupply);
    balances[token0] = token0Balance.plus(balances[token0]);
    balances[token1] = token1Balance.plus(balances[token1]);
  });
  return balances;
}

async function tvl(timestamp, block) {
  const swapVaultBalances = await tvlInSwapVault(timestamp, block);
  const vaultBalances = await tvlInVault(timestamp, block);
  const balances = sdk.util.sum([vaultBalances, swapVaultBalances]);
  return balances;
}

/*==================================================
  Exports
  ==================================================*/

module.exports = { tvl };
