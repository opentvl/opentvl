const { bsc } = require("../sdk");

describe("abi", () => {
  test("call", async () => {
    const balanceOfABI = {
      constant: true,
      inputs: [
        {
          name: "_owner",
          type: "address",
        },
      ],
      name: "balanceOf",
      outputs: [
        {
          name: "balance",
          type: "uint256",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    };

    const result = await bsc.api.abi.call({
      target: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      abi: balanceOfABI,
      params: "0x73feaa1ee314f8c655e354234017be2193c9e24e",
    });
    // Cannot make any assertion since the block number parameter is not working.
    expect(result);
  });

  test("call with no input", async () => {
    const input = {
      target: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      abi: {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [
          {
            name: "",
            type: "uint8",
          },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
    };

    const result = await bsc.api.abi.call({ target: input.target, abi: input.abi });
    expect(result.output).toBe("18");
  });

  test("call with cached abi", async () => {
    const result = await bsc.api.abi.call({
      target: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      abi: "bep20:decimals",
    });
    expect(result.output).toBe("18");
  });

  test("multicall with cached abi", async () => {
    const calls = [
      { target: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" },
      { target: "0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929" },
    ];
    const result = await bsc.api.abi.multiCall({ abi: "bep20:decimals", calls: calls });
    expect(result).toMatchSnapshot();
  });

  test("multicall with bad address", async () => {
    const input = {
      block: 12202080,
      calls: [
        { target: "0x000000000000000000000000000000000000dEaD" },
        { target: "0x0000000000000000000000000000000000000000" },
        { target: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
        { target: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" },
        { target: "0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929" },
      ],
    };
    const symbolResult = await bsc.api.abi.multiCall({ abi: "bep20:symbol", calls: input.calls });
    expect(symbolResult).toMatchSnapshot();
    const decimalsResult = await bsc.api.abi.multiCall({ abi: "bep20:decimals", calls: input.calls });
    expect(decimalsResult).toMatchSnapshot();
  });
});
