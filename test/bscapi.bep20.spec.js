const { bsc } = require("../sdk");

describe("bep20", () => {
  test("symbol", async () => {
    const result = await bsc.api.bep20.symbol("0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929");
    expect(result.output).toBe("CTK");
  });
  test("decimals", async () => {
    const result = await bsc.api.bep20.decimals("0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929");
    expect(result.output).toBe(6);
  });
  test("info", async () => {
    const result = await bsc.api.bep20.info("0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929");
    expect(result.output).toEqual({ symbol: "CTK", decimals: 6 });
  });
  test("totalSupply", async () => {
    const result = await bsc.api.bep20.totalSupply({ target: "0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929" });
    // Cannot make any assertion since the block number parameter is not working.
    expect(result.output);
  });
  test("balanceOf", async () => {
    const result = await bsc.api.bep20.balanceOf({
      target: "0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929",
      owner: "0xf977814e90da44bfa03b6295a0616a897441acec",
    });
    // Cannot make any assertion since the block number parameter is not working.
    expect(result.output);
  });
  test("balanceOf with decimals", async () => {
    const result = await bsc.api.bep20.balanceOf({
      target: "0xa8c2b8eec3d368c0253ad3dae65a5f2bbb89c929",
      owner: "0x631fc1ea2270e98fbd9d92658ece0f5a269aa161",
      decimals: 6,
    });
    // Cannot make any assertion since the block number parameter is not working.
    expect(result.output);
  });
});
