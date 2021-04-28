const sdk = require("../../sdk");

const STAKING = require("./abis/staking.json");

const REWARDS_TOKEN_ABI = STAKING.find(item => item.name === "rewardsToken");
const STAKING_TOKEN_ABI = STAKING.find(item => item.name === "stakingToken");

const STAKING_CONTRACT = "0x1dE3877c9012824C9Acc39995647754b1fa9959f";

async function tvl(_, block) {
  const stakingTokenAddr = (
    await sdk.eth.abi.call({
      abi: STAKING_TOKEN_ABI,
      target: STAKING_CONTRACT
    })
  ).output;

  const rewardsTokenAddr = (
    await sdk.eth.abi.call({
      abi: REWARDS_TOKEN_ABI,
      target: STAKING_CONTRACT
    })
  ).output;

  const totalRewards = (
    await sdk.eth.erc20.balanceOf({
      target: rewardsTokenAddr,
      owner: STAKING_CONTRACT
    })
  ).output;

  const totalReservedInPair = await sdk.eth.swap.getReservedBalances([stakingTokenAddr]);

  // reserve balance + reward balance
  const reserveBalances = {
    [rewardsTokenAddr]: totalRewards,
    ...totalReservedInPair
  };

  return { eth: reserveBalances };
}

module.exports = {
  version: "2", // to distinguish new version from old version
  name: "OrionProtocol",
  token: "ORN",
  category: "derivatives",
  start: 1601093328, // Sep-26-2020 04:08:48 PM +UTC
  tvl
};
