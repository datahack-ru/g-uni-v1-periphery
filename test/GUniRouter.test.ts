import { expect } from "chai";
//import { BigNumber } from "bignumber.js";
import { ethers, network } from "hardhat";
import { IERC20, GUniRouter, IGUniPool, IWETH } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses("ropsten");

describe("GUniRouter", function () {
  this.timeout(0);
  let user0: SignerWithAddress;
  //let user1: SignerWithAddress;
  let wethToken: IERC20;
  let daiToken: IERC20;
  let gUniToken: IERC20;
  let weth: IWETH;
  let gUniPool: IGUniPool;
  let gUniRouter: GUniRouter;
  before(async function () {
    [user0] = await ethers.getSigners();

    gUniPool = (await ethers.getContractAt(
      "IGUniPool",
      addresses.GUNIV3
    )) as IGUniPool;
    wethToken = (await ethers.getContractAt(
      "IERC20",
      addresses.WETH
    )) as IERC20;
    daiToken = (await ethers.getContractAt("IERC20", addresses.DAI)) as IERC20;
    gUniToken = (await ethers.getContractAt(
      "IERC20",
      addresses.GUNIV3
    )) as IERC20;

    const gUniRouterFactory = await ethers.getContractFactory("GUniRouter");

    gUniRouter = (await gUniRouterFactory.deploy(addresses.WETH)) as GUniRouter;

    const daiFaucet = "0xEB52Ce516a8d054A574905BDc3D4a176D3a2d51a";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [daiFaucet],
    });

    const faucetSigner = await ethers.provider.getSigner(daiFaucet);
    await daiToken
      .connect(faucetSigner)
      .transfer(await user0.getAddress(), await daiToken.balanceOf(daiFaucet));

    weth = (await ethers.getContractAt("IWETH", addresses.WETH)) as IWETH;

    weth.deposit({ value: ethers.utils.parseEther("500") });
  });

  describe("deposits through router contract", function () {
    it("Should deposit funds into a GUniPool", async function () {
      daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      wethToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("100000"));
      const balanceDaiBefore = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceWethBefore = await wethToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      await gUniRouter.addLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("10"),
        0,
        0
      );
      const balanceDaiAfter = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceWethAfter = await wethToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceWethBefore).to.be.gt(balanceWethAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);
    });
  });
});
