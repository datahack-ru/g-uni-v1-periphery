import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  IERC20,
  GUniResolver,
  GUniRouter,
  IGUniPool,
  IWETH,
  IUniswapV3Pool,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses("ropsten");

describe("GUni Periphery Contracts", function () {
  this.timeout(0);
  let user0: SignerWithAddress;
  //let user1: SignerWithAddress;
  let wethToken: IERC20;
  let daiToken: IERC20;
  let gUniToken: IERC20;
  let weth: IWETH;
  let gUniPool: IGUniPool;
  let gUniRouter: GUniRouter;
  let pool: IUniswapV3Pool;
  let resolver: GUniResolver;
  before(async function () {
    [user0] = await ethers.getSigners();
    const gUniFactory = await ethers.getContractAt(
      ["function getGelatoPools() external view returns(address[] memory)"],
      addresses.GUniFactory
    );
    const pools = await gUniFactory.getGelatoPools();
    const poolAddress = pools[0];
    gUniPool = (await ethers.getContractAt(
      "IGUniPool",
      poolAddress
    )) as IGUniPool;
    wethToken = (await ethers.getContractAt(
      "IERC20",
      addresses.WETH
    )) as IERC20;
    daiToken = (await ethers.getContractAt("IERC20", addresses.DAI)) as IERC20;
    gUniToken = (await ethers.getContractAt("IERC20", poolAddress)) as IERC20;

    pool = (await ethers.getContractAt(
      "IUniswapV3Pool",
      await gUniPool.pool()
    )) as IUniswapV3Pool;

    const gUniRouterFactory = await ethers.getContractFactory("GUniRouter");

    gUniRouter = (await gUniRouterFactory.deploy(
      addresses.UniswapV3Factory,
      addresses.WETH
    )) as GUniRouter;

    const gUniResolverFactory = await ethers.getContractFactory("GUniResolver");
    resolver = (await gUniResolverFactory.deploy()) as GUniResolver;

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

  describe("deposits through GUniRouter", function () {
    it("should deposit funds with addLiquidity and addLiquidityETH", async function () {
      await daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      await wethToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("100000"));
      let balanceDaiBefore = await daiToken.balanceOf(await user0.getAddress());
      const balanceWethBefore = await wethToken.balanceOf(
        await user0.getAddress()
      );
      let balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      await resolver.getRebalanceParams(
        gUniPool.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("10"),
        500
      );

      await gUniRouter.addLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("10"),
        0,
        0,
        await user0.getAddress()
      );
      let balanceDaiAfter = await daiToken.balanceOf(await user0.getAddress());
      const balanceWethAfter = await wethToken.balanceOf(
        await user0.getAddress()
      );
      let balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceWethBefore).to.be.gt(balanceWethAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);
      balanceDaiBefore = balanceDaiAfter;
      balanceGUniBefore = balanceGUniAfter;

      await gUniRouter.addLiquidityETH(
        gUniPool.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("10"),
        0,
        0,
        await user0.getAddress(),
        { value: ethers.utils.parseEther("10") }
      );

      balanceDaiAfter = await daiToken.balanceOf(await user0.getAddress());
      balanceGUniAfter = await gUniToken.balanceOf(await user0.getAddress());
      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);
      const contractBalanceEth = await user0.provider?.getBalance(
        gUniRouter.address
      );

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
      expect(contractBalanceEth).to.equal(ethers.constants.Zero);
    });

    it("should deposit funds with rebalanceAndAddLiquidity and rebalanceAndAddLiquidityETH", async function () {
      daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      wethToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("100000"));
      const balanceDaiBefore = await daiToken.balanceOf(
        await user0.getAddress()
      );
      let balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      const { sqrtPriceX96 } = await pool.slot0();

      await gUniRouter.rebalanceAndAddLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("1000"),
        0,
        true,
        ethers.utils.parseEther("500"),
        sqrtPriceX96.div("100"),
        0,
        0,
        await user0.getAddress()
      );

      const balanceDaiAfter = await daiToken.balanceOf(
        await user0.getAddress()
      );
      let balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);
      balanceGUniBefore = balanceGUniAfter;

      let contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      let contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      let contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);
      let contractBalanceEth = await user0.provider?.getBalance(
        gUniRouter.address
      );

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
      expect(contractBalanceEth).to.equal(ethers.constants.Zero);

      await gUniRouter.rebalanceAndAddLiquidityETH(
        gUniPool.address,
        0,
        ethers.utils.parseEther("10"),
        false,
        ethers.utils.parseEther("5"),
        sqrtPriceX96.mul("100"),
        0,
        0,
        await user0.getAddress(),
        { value: ethers.utils.parseEther("10") }
      );

      balanceGUniAfter = await gUniToken.balanceOf(await user0.getAddress());
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);
      contractBalanceEth = await user0.provider?.getBalance(gUniRouter.address);

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
      expect(contractBalanceEth).to.equal(ethers.constants.Zero);
    });
  });
  describe("withdrawal through GUniRouter", function () {
    it("should withdraw funds with removeLiquidity and removeLiquidityETH", async function () {
      let balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceGUniBefore).to.be.gt(ethers.constants.Zero);

      const halfBalance = balanceGUniBefore.div("2");
      let balanceDaiBefore = await daiToken.balanceOf(await user0.getAddress());
      let balanceWethBefore = await wethToken.balanceOf(
        await user0.getAddress()
      );
      await gUniToken.approve(
        gUniRouter.address,
        ethers.utils.parseEther("100000000")
      );
      await gUniRouter.removeLiquidity(
        gUniPool.address,
        halfBalance,
        0,
        0,
        await user0.getAddress()
      );
      let balanceDaiAfter = await daiToken.balanceOf(await user0.getAddress());
      let balanceWethAfter = await wethToken.balanceOf(
        await user0.getAddress()
      );
      let balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      expect(balanceDaiAfter).to.be.gt(balanceDaiBefore);
      expect(balanceWethAfter).to.be.gt(balanceWethBefore);
      expect(balanceGUniBefore).to.be.gt(balanceGUniAfter);
      balanceDaiBefore = balanceDaiAfter;
      balanceWethBefore = balanceWethAfter;
      balanceGUniBefore = balanceGUniAfter;

      const balanceEthBefore = await user0.provider?.getBalance(
        await user0.getAddress()
      );

      await gUniRouter.removeLiquidityETH(
        gUniPool.address,
        balanceGUniBefore,
        0,
        0,
        await user0.getAddress()
      );

      const balanceEthAfter = await user0.provider?.getBalance(
        await user0.getAddress()
      );

      balanceDaiAfter = await daiToken.balanceOf(await user0.getAddress());
      balanceWethAfter = await wethToken.balanceOf(await user0.getAddress());
      balanceGUniAfter = await gUniToken.balanceOf(await user0.getAddress());

      expect(balanceDaiAfter).to.be.gt(balanceDaiBefore);
      expect(balanceEthAfter).to.be.gt(balanceEthBefore);
      expect(balanceWethBefore).to.equal(balanceWethAfter);
      expect(balanceGUniBefore).to.be.gt(balanceGUniAfter);

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);
      const contractBalanceEth = await user0.provider?.getBalance(
        gUniRouter.address
      );

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
      expect(contractBalanceEth).to.equal(ethers.constants.Zero);
    });
  });
  describe("GUniResolver helper functions", function () {
    it("should work", async function () {
      await daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      await wethToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("100000"));

      await gUniRouter.addLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("10"),
        0,
        0,
        await user0.getAddress()
      );
      const { sqrtPriceX96 } = await pool.slot0();
      const twoX96 = ethers.BigNumber.from("2").pow(
        ethers.BigNumber.from("96")
      );
      const intermediate = sqrtPriceX96.mul(sqrtPriceX96).div(twoX96);
      const price = twoX96.div(intermediate);
      console.log(price.toString());

      const { amount0, amount1 } = await resolver.getPoolUnderlyingBalances(
        gUniPool.address
      );
      console.log(ethers.utils.formatEther(amount0));
      console.log(ethers.utils.formatEther(amount1));

      const {
        zeroForOne: isZeroForOne,
        swapAmount,
        swapThreshold,
      } = await resolver.getRebalanceParams(
        gUniPool.address,
        0,
        ethers.utils.parseEther("1"),
        500
      );

      console.log(ethers.utils.formatEther(swapAmount));

      const balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      await gUniRouter.rebalanceAndAddLiquidity(
        gUniPool.address,
        0,
        ethers.utils.parseEther("1"),
        isZeroForOne,
        swapAmount,
        swapThreshold,
        0,
        0,
        await user0.getAddress()
      );

      const balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      const balanceChange = balanceGUniAfter.sub(balanceGUniBefore);

      const { amount0: mint0, amount1: mint1 } =
        await resolver.getUnderlyingBalances(gUniPool.address, balanceChange);

      console.log(ethers.utils.formatEther(mint0));
      console.log(ethers.utils.formatEther(mint1));
    });
  });
});
