import { expect } from "chai";
import { ethers, network } from "hardhat";
import { IERC20, GUniRouter02, IGUniPool } from "../typechain";
import fetch from "node-fetch";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses("mainnet");

const approveTokenData = async (
  networkId: string,
  tokenAddress: string,
  amount: string
): Promise<{ to: string; data: string }> => {
  try {
    const apiResponse = (await (
      await fetch(
        `https://api.1inch.exchange/v3.0/${networkId}/approve/calldata?amount=${amount}&tokenAddress=${tokenAddress}`
      )
    ).json()) as unknown as {
      data: string;
      gasPrice: string;
      to: string;
      value: string;
    };

    return {
      to: apiResponse.to,
      data: apiResponse.data,
    };
  } catch (error) {
    console.log(
      `1Inch approve data call failed, for ${amount} amount of ${tokenAddress}. Error : ${error}`
    );
    throw new Error(`approveTokenData: 1Inch approve data call failed.`);
  }
};

const swapTokenData = async (
  networkId: string,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string,
  fromAddress: string,
  slippage: string
): Promise<{ to: string; data: string }> => {
  try {
    const apiResponse = (await (
      await fetch(
        `https://api.1inch.exchange/v3.0/${networkId}/swap?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${fromAddress}&slippage=${slippage}&disableEstimate=true`
      )
    ).json()) as unknown as {
      tx: {
        from: string;
        to: string;
        data: string;
        value: string;
        gasPrice: string;
        gas: string;
      };
    };

    return {
      to: apiResponse.tx.to,
      data: apiResponse.tx.data,
    };
  } catch (error) {
    console.log(
      `1Inch swap data call failed, wanted to swap ${amount} amount of ${fromTokenAddress} to ${toTokenAddress}, from ${fromAddress} with a slippage of ${slippage} . Error : ${error}`
    );
    throw new Error(`swapTokenData: 1Inch swap data call failed.`);
  }
};

describe("GUni Periphery Contracts", function () {
  this.timeout(0);
  let user0: SignerWithAddress;
  //let user1: SignerWithAddress;
  let usdcToken: IERC20;
  let daiToken: IERC20;
  let gUniToken: IERC20;
  let gUniPool: IGUniPool;
  let gUniRouter: GUniRouter02;
  //let pool: IUniswapV3Pool;
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
    daiToken = (await ethers.getContractAt("IERC20", addresses.DAI)) as IERC20;
    usdcToken = (await ethers.getContractAt(
      "IERC20",
      addresses.USDC
    )) as IERC20;
    gUniToken = (await ethers.getContractAt("IERC20", poolAddress)) as IERC20;

    const gUniRouterFactory = await ethers.getContractFactory("GUniRouter02");

    gUniRouter = (await gUniRouterFactory.deploy(
      addresses.WETH
    )) as GUniRouter02;

    //const gUniResolverFactory = await ethers.getContractFactory("GUniResolver");
    //resolver = (await gUniResolverFactory.deploy()) as GUniResolver;

    const daiFaucet = "0x5A16552f59ea34E44ec81E58b3817833E9fD5436";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [daiFaucet],
    });
    const faucetSigner = await ethers.provider.getSigner(daiFaucet);
    await daiToken
      .connect(faucetSigner)
      .transfer(await user0.getAddress(), await daiToken.balanceOf(daiFaucet));
    const usdcFaucet = "0x655A7990369F7321735D572f4f53ee0a7f544d3A";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcFaucet],
    });
    const faucetSigner2 = await ethers.provider.getSigner(usdcFaucet);
    await usdcToken
      .connect(faucetSigner2)
      .transfer(
        await user0.getAddress(),
        await usdcToken.balanceOf(usdcFaucet)
      );
  });

  describe("deposits through GUniRouter", function () {
    it("should deposit funds with addLiquidity", async function () {
      await daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      await usdcToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      const balanceDaiBefore = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      await gUniRouter.addLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("100000"),
        (100000 * 10 ** 6).toString(),
        0,
        0,
        await user0.getAddress()
      );

      const balanceDaiAfter = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      //console.log("DAI deposit:", balanceDaiBefore.sub(balanceDaiAfter).toString())
      //console.log("USDC deposit:", balanceUsdcBefore.sub(balanceUsdcAfter).toString())
      //console.log("G-UNI minted:", balanceGUniAfter.sub(balanceGUniBefore).toString())

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });

    it("should deposit funds with rebalanceAndAddLiquidity and rebalanceAndAddLiquidityETH", async function () {
      await daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      await usdcToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      //console.log("    skipping for now...");
      const balanceDaiBefore = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      const swapParams = await swapTokenData(
        "1",
        addresses.USDC,
        addresses.DAI,
        (60000 * 10 ** 6).toString(),
        gUniRouter.address,
        "2"
      );

      const approveParams = await approveTokenData(
        "1",
        addresses.USDC,
        (60000 * 10 ** 6).toString()
      );

      await gUniRouter.rebalanceAndAddLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("100000"),
        (100000 * 10 ** 6).toString(),
        [approveParams.to, swapParams.to],
        [approveParams.data, swapParams.data],
        0,
        0,
        await user0.getAddress()
      );

      const balanceDaiAfter = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      //console.log("DAI deposit:", balanceDaiBefore.sub(balanceDaiAfter).toString())
      //console.log("USDC deposit:", balanceUsdcBefore.sub(balanceUsdcAfter).toString())
      //console.log("G-UNI minted:", balanceGUniAfter.sub(balanceGUniBefore).toString())

      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      const diffGUni = balanceGUniAfter.sub(balanceGUniBefore);
      expect(balanceGUniBefore).to.be.lt(diffGUni);

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });
  });
  describe("withdrawal through GUniRouter", function () {
    it("should withdraw funds with removeLiquidity", async function () {
      const balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceGUniBefore).to.be.gt(ethers.constants.Zero);

      const halfBalance = balanceGUniBefore.div("2");
      const balanceDaiBefore = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      await gUniToken.approve(
        gUniRouter.address,
        ethers.utils.parseEther("10000000")
      );
      await gUniRouter.removeLiquidity(
        gUniPool.address,
        halfBalance,
        0,
        0,
        await user0.getAddress()
      );
      const balanceDaiAfter = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniToken.balanceOf(
        await user0.getAddress()
      );

      expect(balanceDaiAfter).to.be.gt(balanceDaiBefore);
      expect(balanceUsdcAfter).to.be.gt(balanceUsdcBefore);
      expect(balanceGUniBefore).to.be.gt(balanceGUniAfter);
    });
  });
});
