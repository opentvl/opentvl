const sdk = require('../../sdk')
const fetch = require('node-fetch')
const BigNumber = require('bignumber.js');

const REWARD_TOKEN = require('./abis/rewardToken.json');
const CAKE = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82';

const START_BLOCK = 586851;
const FACTORY = '0xbcfccbde45ce874adcb698cc183debcf17952812';

async function fetchPairAddresses() {
  const result = await (
    await fetch('https://api.pancakeswap.finance/api/v1/stat')
  ).json();

  const pairAddresses = result.trade_pairs.map(({ swap_pair_contract }) =>
    swap_pair_contract.toLowerCase()
  );

  return pairAddresses;
}

async function getPoolRewards(block) {
  // Get reward token addresses
  const rewardTokens = (await sdk.bsc.abi.multiCall({
    abi: REWARD_TOKEN,
    block,
    calls: SYRUP_POOLS.slice(1).map(poolAddress => ({ target: poolAddress }))
  })).output;

  let rewardForPool = rewardTokens.reduce((acc, res) => {
    if (res.success) {
      const { target: poolAddress } = res.input;
      // Here we make the (valid) assumption that no two pools have the same reward
      acc[poolAddress] = res.output;
    }

    return acc;
  }, {});

  // Get reward token balances
  const rewardBalances = (await sdk.bsc.abi.multiCall({
    abi: "bep20:balanceOf",
    block, 
    calls: Object.entries(rewardForPool)
      .map(([poolAddress, rewardAddress]) => ({ target: rewardAddress, params: poolAddress }))
  })).output;

  // Combine addresses with balances
  return rewardBalances.reduce((acc, res) => {
    const { target: rewardAddress } = res.input;

    if (res.success && rewardAddress.toLowerCase() !== CAKE.toLowerCase()) {
      acc[rewardAddress] = res.output;
    }

    return acc;
  }, {});
}

async function getPoolDeposits(block) {
  const balances = (await sdk.bsc.abi.multiCall({
    target: CAKE,
    abi: "bep20:balanceOf",
    block,
    calls: SYRUP_POOLS.map(address => ({ params: address }))
  })).output;

  return balances.reduce((acc, res) => {
    if (res.success) {
      const existingBalance = new BigNumber(acc[CAKE] ?? '0');
      const additionalBalance = new BigNumber(res.output);

      acc[CAKE] = existingBalance.plus(additionalBalance).toFixed();
    }

    return acc;
  }, {});
}

async function tvl(_, block) {
  const pairAddresses = await fetchPairAddresses();
  //const pairAddresses = await sdk.bsc.swap.getPairAddresses(FACTORY, START_BLOCK, block.bsc);

  const balances = await Promise.all(
    [
      await getPoolRewards(block),
      await getPoolDeposits(block),
      await sdk.bsc.swap.getReservedBalances(pairAddresses)
    ]
  )

  const summedBalances = sdk.util.sum(balances);
  return (await sdk.bsc.util.toSymbols(summedBalances)).output;
}

module.exports = {
  version: '2', // to distinguish new version from old version
  name: 'PancakeSwap',
  token: 'CAKE',
  category: 'dexes',
  start: 1600753669, // Sep-22-2020 05:47:49 AM +UTC
  tvl
}

// Last fetched Apr-23-2021
const SYRUP_POOLS = [
  "0x73feaa1eE314F8c655E354234017bE2193C9E24E",
  "0xaac7171afc93f4b75e1268d208040b152ac65e32",
  "0x2c6017269b4324d016ca5d8e3267368652c18905",
  "0x675434c68f2672c983e36cf10ed13a4014720b79",
  "0x05d6c2d1d687eacfb5e6440d5a3511e91f2201a8",
  "0xd623a32da4a632ce01766c317d07cb2cad56949b",
  "0xdf75f38dbc98f9f26377414e567abcb8d57cca33",
  "0xce64a930884b2c68cd93fc1c7c7cdc221d427692",
  "0xc1E70edd0141c454b834Deac7ddDeA413424aEf9",
  "0x189d8228CdfDc404Bd9e5bD65ff958cb5fd8855c",
  "0x0196c582216e2463f052E2B07Ef8667Bec9Fb17a",
  "0x8f84106286c9c8A42bc3555C835E6e2090684ab7",
  "0xa8d32b31ECB5142f067548Bf0424389eE98FaF26",
  "0xC59aa49aE508050c2dF653E77bE13822fFf02E9A",
  "0x14AeA62384789EDA98f444cCb970F6730877d3F9",
  "0xebb87dF24D65977cbe62538E4B3cFBD5d0308642",
  "0x40918EF8efFF4aA061656013a81E0e5A8A702eA7",
  "0x44eC1B26035865D9A7C130fD872670CD7Ebac2bC",
  "0x1329ad151dE6C441184E32E108401126AE850937",
  "0x9bbDc92474a7e7321B78dcDA5EF35f4981438760",
  "0x46530d79b238f809e80313e73715b160c66677aF",
  "0x47fD853D5baD391899172892F91FAa6d0cd8A2Aa",
  "0xe25aB6F05BBF6C1be953BF2d7df15B3e01b8e5a5",
  "0xEB8Fd597921E3Dd37B0F103a2625F855e2C9b9B5",
  "0xABFd8d1942628124aB971937154f826Bce86DcbC",
  "0x526d3c204255f807C95a99b69596f2f9f72345e5",
  "0xAa2082BeE04fc518300ec673F9497ffa6F669dB8",
  "0x9096625Bc0d36F5EDa6d44e511641667d89C28f4",
  "0x78BD4dB48F8983c3C36C8EAFbEF38f6aC7B55285",
  "0x35418e14F5aA615C4f020eFBa6e01C5DbF15AdD2",
  "0x3c7cC49a35942fbD3C2ad428a6c22490cd709d03",
  "0xF795739737ABcFE0273f4Dced076460fdD024Dd9",
  "0x06FF8960F7F4aE572A3f57FAe77B2882BE94Bf90",
  "0xe4dD0C50fb314A8B2e84D211546F5B57eDd7c2b9",
  "0xb627A7e33Db571bE792B0b69c5C2f5a8160d5500",
  "0xadBfFA25594AF8Bc421ecaDF54D057236a99781e",
  "0x3e31488f08EBcE6F2D8a2AA512aeFa49a3C7dFa7",
  "0x453a75908fb5a36d482d5f8fe88eca836f32ead5",
  "0x509C99D73FB54b2c20689708b3F824147292D38e",
  "0xF1bd5673Ea4a1C415ec84fa3E402F2F7788E7717",
  "0xB4C68A1C565298834360BbFF1652284275120D47",
  "0x153e62257F1AAe05d5d253a670Ca7585c8D3F94F",
  "0xF682D186168b4114ffDbF1291F19429310727151",
  "0xaDdAE5f4dB84847ac9d947AED1304A8e7D19f7cA",
  "0x4C32048628D0d32d4D6c52662FB4A92747782B56",
  "0x47642101e8D8578C42765d7AbcFd0bA31868c523",
  "0x07F8217c68ed9b838b0b8B58C19c79bACE746e9A",
  "0x580DC9bB9260A922E3A4355b9119dB990F09410d",
  "0x6f0037d158eD1AeE395e1c12d21aE8583842F472",
  "0x423382f989C6C289c8D441000e1045e231bd7d90",
  "0x0A595623b58dFDe6eB468b613C11A7A8E84F09b9",
  "0x9E6dA246d369a41DC44673ce658966cAf487f7b2",
  "0x2C0f449387b15793B9da27c2d945dBed83ab1B07",
  "0x0c3D6892aa3b23811Af3bd1bbeA8b0740E8e4528",
  "0x75C91844c5383A68b7d3A427A44C32E3ba66Fe45",
  "0xC58954199E268505fa3D3Cb0A00b7207af8C2D1d",
  "0xA5137e08C48167E363Be8Ec42A68f4F54330964E",
  "0x6F31B87f51654424Ce57E9F8243E27ed13846CDB",
  "0xCE54BA909d23B9d4BE0Ff0d84e5aE83F0ADD8D9a",
  "0x3e677dC00668d69c2A7724b9AFA7363e8A56994e",
  "0x5Ac8406498dC1921735d559CeC271bEd23B294A7",
  "0xb69b6e390cba1F68442A886bC89E955048DAe7E3",
  "0xae3001ddb18A6A57BEC2C19D71680437CA87bA1D",
  "0x02aa767e855b8e80506fb47176202aA58A95315a",
  "0x1c736F4FB20C7742Ee83a4099fE92abA61dFca41",
  "0x02861B607a5E87daf3FD6ec19DFB715F1b371379",
  "0x73e4E8d010289267dEe3d1Fc48974B60363963CE",
  "0xE0565fBb109A3f3f8097D8A9D931277bfd795072",
  "0xc3693e3cbc3514d5d07EA5b27A721F184F617900",
  "0x2B02d43967765b18E31a9621da640588f3550EFD",
  "0x212bb602418C399c29D52C55100fD6bBa12bea05",
  "0x04aE8ca68A116278026fB721c06dCe709eD7013C",
  "0x1714bAAE9DD4738CDEA07756427FA8d4F08D9479",
  "0xcCD0b93cC6ce3dC6dFaA9DB68f70e5C8455aC5bd",
  "0x9cB24e9460351bC51d4066BC6AEd1F3809b02B78",
  "0x2dcf4cDFf4Dd954683Fe0a6123077f8a025b66cF",
  "0x6EFa207ACdE6e1caB77c1322CbdE9628929ba88F",
  "0xD0b738eC507571176D40f28bd56a0120E375f73a",
  "0xf7a31366732F08E8e6B88519dC3E827e04616Fc9",
  "0x9F23658D5f4CEd69282395089B0f8E4dB85C6e79",
  "0xB6fd2724cc9c90DD31DA35DbDf0300009dceF97d",
  "0x108BFE84Ca8BCe0741998cb0F60d313823cEC143",
  "0x4A26b082B432B060B1b00A84eE4E823F04a6f69a",
  "0x3cc08B7C6A31739CfEd9d8d38b484FDb245C79c8",
  "0xd18E1AEb349ef0a6727eCe54597D98D263e05CAB",
  "0x68C7d180bD8F7086D91E65A422c59514e4aFD638",
  "0xbE65d7e42E05aD2c4ad28769dc9c5b4b6EAff2C7",
  "0x1500fa1afbfe4f4277ed0345cdf12b2c9ca7e139",
  "0x624ef5C2C6080Af188AF96ee5B3160Bb28bb3E02",
  "0x0554a5D083Abf2f056ae3F6029e1714B9A655174",
  "0x543467B17cA5De50c8BF7285107A36785Ab57E56",
  "0x65aFEAFaec49F23159e897EFBDCe19D94A86A1B6",
  "0x1AD34D8d4D79ddE88c9B6b8490F8fC67831f2CAe",
  "0x555Ea72d7347E82C614C16f005fA91cAf06DCB5a",
  "0x326D754c64329aD7cb35744770D56D0E1f3B3124",
  "0x42Afc29b2dEa792974d1e9420696870f1Ca6d18b",
  "0xBb2B66a2c7C2fFFB06EA60BeaD69741b3f5BF831",
  "0xFb1088Dae0f03C5123587d2babb3F307831E6367",
  "0x9c4EBADa591FFeC4124A7785CAbCfb7068fED2fb",
  "0x90F995b9d46b32c4a1908A8c6D0122e392B3Be97",
  "0xdc8c45b7F3747Ca9CaAEB3fa5e0b5FCE9430646b",
  "0xFF02241a2A1d2a7088A344309400E9fE74772815",
  "0xDc938BA1967b06d666dA79A7B1E31a8697D1565E",
  "0x07a0A5B67136d40F4d7d95Bc8e0583bafD7A81b9",
  "0x21A9A53936E812Da06B7623802DEc9A1f94ED23a",
  "0xe7f9A439Aa7292719aC817798DDd1c4D35934aAF",
  "0xcec2671C81a0Ecf7F8Ee796EFa6DBDc5Cb062693"
];