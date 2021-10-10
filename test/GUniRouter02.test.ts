import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  IERC20,
  GUniResolver02,
  GUniRouter02,
  IGUniPool,
  GUniStaticFactory,
} from "../typechain";
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
        `https://api.1inch.exchange/v3.0/${networkId}/swap?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${fromAddress}&slippage=${slippage}&disableEstimate=true&protocols=CURVE,SUSHI,KYBER`
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

const quote1Inch = async (
  networkId: string,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string
): Promise<string> => {
  try {
    const apiResponse = (await (
      await fetch(
        `https://api.1inch.exchange/v3.0/${networkId}/quote?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&protocols=CURVE`
      )
    ).json()) as unknown as {
      toTokenAmount: string;
    };

    return apiResponse.toTokenAmount;
  } catch (error) {
    console.log(
      `1Inch quote call failed, wanted to quote swap of ${amount} amount of ${fromTokenAddress} to ${toTokenAddress}. Error : ${error}`
    );
    throw new Error(`swapTokenData: 1Inch swap data call failed.`);
  }
};

describe("GUni Periphery Contracts: Version 2", function () {
  this.timeout(0);
  let user0: SignerWithAddress;
  //let user1: SignerWithAddress;
  let usdcToken: IERC20;
  let daiToken: IERC20;
  let wethToken: IERC20;
  let gUniToken: IERC20;
  let gUniPool: IGUniPool;
  let gUniRouter: GUniRouter02;
  let gUniResolver: GUniResolver02;
  let gUniEthPool: IGUniPool;
  let gUniEthToken: IERC20;
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
    gUniEthPool = (await ethers.getContractAt(
      "IGUniPool",
      "0xa6c49FD13E50a30C65E6C8480aADA132011D0613"
    )) as IGUniPool;
    daiToken = (await ethers.getContractAt("IERC20", addresses.DAI)) as IERC20;
    usdcToken = (await ethers.getContractAt(
      "IERC20",
      addresses.USDC
    )) as IERC20;
    wethToken = (await ethers.getContractAt(
      "IERC20",
      addresses.WETH
    )) as IERC20;
    gUniToken = (await ethers.getContractAt("IERC20", poolAddress)) as IERC20;
    gUniEthToken = (await ethers.getContractAt(
      "IERC20",
      "0xa6c49FD13E50a30C65E6C8480aADA132011D0613"
    )) as IERC20;

    const gUniRouterFactory = await ethers.getContractFactory("GUniRouter02");

    gUniRouter = (await gUniRouterFactory.deploy(
      addresses.WETH
    )) as GUniRouter02;

    const gUniResolverFactory = await ethers.getContractFactory(
      "GUniResolver02"
    );
    gUniResolver = (await gUniResolverFactory.deploy()) as GUniResolver02;

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

  describe("deposits through GUniRouter02", function () {
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

      const mintAmounts = await gUniPool.getMintAmounts(
        ethers.utils.parseEther("100000"),
        (100000 * 10 ** 6).toString()
      );

      await gUniRouter.addLiquidity(
        gUniPool.address,
        ethers.utils.parseEther("100000"),
        (100000 * 10 ** 6).toString(),
        mintAmounts.amount0,
        mintAmounts.amount1,
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

      /*console.log(
        "DAI deposit:",
        ethers.utils.formatEther(balanceDaiBefore.sub(balanceDaiAfter))
      );
      console.log(
        "USDC deposit:",
        ethers.utils.formatUnits(balanceUsdcBefore.sub(balanceUsdcAfter), "6")
      );
      console.log("G-UNI minted:", balanceGUniAfter.sub(balanceGUniBefore).toString())*/

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });

    it("should deposit funds with addLiquidityETH", async function () {
      await usdcToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      const balanceEthBefore = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );

      const mintAmounts = await gUniEthPool.getMintAmounts(
        (100000 * 10 ** 6).toString(),
        ethers.utils.parseEther("100")
      );

      await gUniRouter.addLiquidityETH(
        gUniEthPool.address,
        (100000 * 10 ** 6).toString(),
        ethers.utils.parseEther("100"),
        mintAmounts.amount0,
        mintAmounts.amount1,
        await user0.getAddress(),
        { value: ethers.utils.parseEther("100") }
      );

      const balanceEthAfter = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceEthBefore).to.be.gt(balanceEthAfter);
      expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      /*console.log(
        "ETH deposit:",
        ethers.utils.formatEther(balanceEthBefore.sub(balanceEthAfter))
      );
      console.log(
        "USDC deposit:",
        ethers.utils.formatUnits(balanceUsdcBefore.sub(balanceUsdcAfter), "6")
      );
      console.log("G-UNI minted:", balanceGUniAfter.sub(balanceGUniBefore).toString())*/

      const contractBalanceEth = await daiToken.provider.getBalance(
        gUniRouter.address
      );
      const contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      const contractBalanceUsdc = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceEth).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceUsdc).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });

    it("should deposit funds with rebalanceAndAddLiquidity (swap token1)", async function () {
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
      const spendAmountUSDC = ethers.utils.parseUnits("100000", "6");
      const spendAmountDAI = ethers.utils.parseUnits("100000", "18");

      //await new Promise((r) => setTimeout(r, 2000));
      const quoteAmount = await quote1Inch(
        "1",
        addresses.USDC,
        addresses.DAI,
        spendAmountUSDC.toString()
      );

      const denominator = ethers.BigNumber.from(quoteAmount).mul(
        ethers.BigNumber.from((10 ** 6).toString())
      );
      const numerator = ethers.BigNumber.from(spendAmountUSDC.toString()).mul(
        ethers.utils.parseEther("1")
      );
      const priceX18 = numerator
        .mul(ethers.utils.parseEther("1"))
        .div(denominator);
      //console.log("price check:", priceX18.toString());

      const result = await gUniResolver.getRebalanceParams(
        gUniPool.address,
        spendAmountDAI,
        spendAmountUSDC.toString(),
        priceX18
      );
      expect(result.zeroForOne).to.be.false;

      const quoteAmount2 = await quote1Inch(
        "1",
        addresses.USDC,
        addresses.DAI,
        result.swapAmount.toString()
      );

      const denominator2 = ethers.BigNumber.from(quoteAmount2).mul(
        ethers.BigNumber.from((10 ** 6).toString())
      );
      const numerator2 = result.swapAmount.mul(ethers.utils.parseEther("1"));
      const price2 = numerator2
        .mul(ethers.utils.parseEther("1"))
        .div(denominator2);

      const result2 = await gUniResolver.getRebalanceParams(
        gUniPool.address,
        spendAmountDAI,
        spendAmountUSDC.toString(),
        price2
      );
      expect(result2.zeroForOne).to.be.false;

      const quoteAmount3 = await quote1Inch(
        "1",
        addresses.USDC,
        addresses.DAI,
        result2.swapAmount.toString()
      );

      const amountDAIIn = spendAmountDAI.add(
        ethers.BigNumber.from(quoteAmount3)
      );
      const amountUSDCIn = ethers.BigNumber.from(
        spendAmountUSDC.toString()
      ).sub(result2.swapAmount);
      const mintAmounts = await gUniPool.getMintAmounts(
        amountDAIIn,
        amountUSDCIn
      );

      console.log(
        "swap amount:",
        ethers.utils.formatUnits(result2.swapAmount, "6")
      );
      console.log(
        "return amount:",
        ethers.utils.formatEther(ethers.BigNumber.from(quoteAmount3))
      );
      console.log(
        "dai expected:",
        ethers.utils.formatEther(mintAmounts.amount0)
      );
      console.log(
        "usdc expected:",
        ethers.utils.formatUnits(mintAmounts.amount1, "6")
      );

      const swapParams = await swapTokenData(
        "1",
        addresses.USDC,
        addresses.DAI,
        result2.swapAmount.toString(),
        gUniRouter.address,
        "10"
      );

      const approveParams = await approveTokenData(
        "1",
        addresses.USDC,
        result2.swapAmount.toString()
      );

      await gUniRouter.rebalanceAndAddLiquidity(
        gUniPool.address,
        spendAmountDAI,
        spendAmountUSDC.toString(),
        result2.swapAmount.toString(),
        false,
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

      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      console.log(
        "DAI input:",
        ethers.utils.formatEther(balanceDaiBefore.sub(balanceDaiAfter))
      );
      console.log(
        "USDC input:",
        ethers.utils.formatUnits(balanceUsdcBefore.sub(balanceUsdcAfter), "6")
      );
      console.log(
        "G-UNI minted:",
        balanceGUniAfter.sub(balanceGUniBefore).toString()
      );
      const balanceChange = balanceGUniAfter.sub(balanceGUniBefore);
      const reserves = await gUniPool.getUnderlyingBalances();
      const supply = await gUniPool.totalSupply();
      const balance0 = reserves.amount0.mul(balanceChange).div(supply);
      const balance1 = reserves.amount1.mul(balanceChange).div(supply);
      console.log("DAI deposited:", ethers.utils.formatEther(balance0));
      console.log("USDC deposited:", ethers.utils.formatUnits(balance1, "6"));

      const diffGUni = balanceGUniAfter.sub(balanceGUniBefore);
      expect(balanceGUniBefore).to.be.lt(diffGUni);

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });
    it("should deposit funds with rebalanceAndAddLiquidity (swap token0)", async function () {
      await daiToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      await usdcToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseUnits("1000000", "6"));
      const balanceDaiBefore = await daiToken.balanceOf(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniToken.balanceOf(
        await user0.getAddress()
      );
      const spendAmountUSDC = ethers.utils.parseUnits("10000", "6");
      const spendAmountDAI = ethers.utils.parseUnits("100000", "18");
      //console.log("dai balance:", ethers.utils.formatEther(balanceDaiBefore));

      //await new Promise((r) => setTimeout(r, 2000));
      const quoteAmount = await quote1Inch(
        "1",
        addresses.DAI,
        addresses.USDC,
        spendAmountDAI.toString()
      );

      const numerator = ethers.BigNumber.from(quoteAmount).mul(
        ethers.utils.parseEther("1")
      );
      const denominator = spendAmountDAI.mul(
        ethers.BigNumber.from((10 ** 6).toString())
      );
      const priceX18 = numerator
        .mul(ethers.utils.parseEther("1"))
        .div(denominator);
      //console.log("price check:", priceX18.toString());

      const result = await gUniResolver.getRebalanceParams(
        gUniPool.address,
        spendAmountDAI,
        spendAmountUSDC,
        priceX18
      );
      expect(result.zeroForOne).to.be.true;

      const quoteAmount2 = await quote1Inch(
        "1",
        addresses.DAI,
        addresses.USDC,
        result.swapAmount.toString()
      );

      const numerator2 = ethers.BigNumber.from(quoteAmount2).mul(
        ethers.utils.parseEther("1")
      );
      const denominator2 = result.swapAmount.mul(
        ethers.BigNumber.from((10 ** 6).toString())
      );
      const price2 = numerator2
        .mul(ethers.utils.parseEther("1"))
        .div(denominator2);

      const result2 = await gUniResolver.getRebalanceParams(
        gUniPool.address,
        spendAmountDAI,
        spendAmountUSDC,
        price2
      );
      expect(result2.zeroForOne).to.be.true;

      const quoteAmount3 = await quote1Inch(
        "1",
        addresses.DAI,
        addresses.USDC,
        result2.swapAmount.toString()
      );

      const amountUSDCIn = spendAmountUSDC.add(
        ethers.BigNumber.from(quoteAmount3)
      );
      const amountDAIIn = spendAmountDAI.sub(result2.swapAmount);

      const mintAmounts = await gUniPool.getMintAmounts(
        amountDAIIn,
        amountUSDCIn
      );

      console.log("swap amount:", ethers.utils.formatEther(result2.swapAmount));
      console.log(
        "return amount:",
        ethers.utils.formatUnits(ethers.BigNumber.from(quoteAmount3), "6")
      );
      console.log(
        "dai expected:",
        ethers.utils.formatEther(mintAmounts.amount0)
      );
      console.log(
        "usdc expected:",
        ethers.utils.formatUnits(mintAmounts.amount1, "6")
      );

      const swapParams = await swapTokenData(
        "1",
        addresses.DAI,
        addresses.USDC,
        result2.swapAmount.toString(),
        gUniRouter.address,
        "10"
      );

      const approveParams = await approveTokenData(
        "1",
        addresses.DAI,
        result2.swapAmount.toString()
      );

      await gUniRouter.rebalanceAndAddLiquidity(
        gUniPool.address,
        spendAmountDAI,
        spendAmountUSDC,
        result2.swapAmount.toString(),
        true,
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

      expect(balanceDaiBefore).to.be.gt(balanceDaiAfter);
      //expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      console.log(
        "DAI input:",
        ethers.utils.formatEther(balanceDaiBefore.sub(balanceDaiAfter))
      );
      console.log(
        "USDC input:",
        ethers.utils.formatUnits(balanceUsdcBefore.sub(balanceUsdcAfter), "6")
      );
      console.log(
        "G-UNI minted:",
        balanceGUniAfter.sub(balanceGUniBefore).toString()
      );
      const balanceChange = balanceGUniAfter.sub(balanceGUniBefore);
      const reserves = await gUniPool.getUnderlyingBalances();
      const supply = await gUniPool.totalSupply();
      const balance0 = reserves.amount0.mul(balanceChange).div(supply);
      const balance1 = reserves.amount1.mul(balanceChange).div(supply);
      console.log("DAI deposited:", ethers.utils.formatEther(balance0));
      console.log("USDC deposited:", ethers.utils.formatUnits(balance1, "6"));

      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      const contractBalanceDai = await daiToken.balanceOf(gUniRouter.address);
      const contractBalanceWeth = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceDai).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });
    it("should deposit funds with rebalanceAndAddLiquidityETH (swap for ETH)", async function () {
      await usdcToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      const balanceEthBefore = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );
      const spendAmountETH = ethers.utils.parseEther("30");
      const spendAmountUSDC = 100000 * 10 ** 6;

      const swapParams = await swapTokenData(
        "1",
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        addresses.USDC,
        ethers.utils.parseEther("5").toString(),
        gUniRouter.address,
        "50"
      );

      await gUniRouter.rebalanceAndAddLiquidityETH(
        gUniEthPool.address,
        spendAmountUSDC.toString(),
        spendAmountETH,
        ethers.utils.parseEther("5"),
        false,
        [swapParams.to],
        [swapParams.data],
        0,
        0,
        await user0.getAddress(),
        { value: spendAmountETH }
      );

      const balanceEthAfter = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceEthBefore).to.be.gt(balanceEthAfter);
      expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      /*console.log(
        "ETH deposit:",
        ethers.utils.formatEther(balanceEthBefore.sub(balanceEthAfter))
      );
      console.log(
        "USDC deposit:",
        ethers.utils.formatUnits(balanceUsdcBefore.sub(balanceUsdcAfter), "6")
      );
      console.log("G-UNI minted:", balanceGUniAfter.sub(balanceGUniBefore).toString())*/

      const contractBalanceEth = await daiToken.provider.getBalance(
        gUniRouter.address
      );
      const contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      const contractBalanceUsdc = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceEth).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceUsdc).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });
    it("should deposit funds with rebalanceAndAddLiquidityETH (swap to WETH)", async function () {
      await usdcToken
        .connect(user0)
        .approve(gUniRouter.address, ethers.utils.parseEther("1000000"));
      const balanceEthBefore = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniBefore = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );
      const spendAmountETH = ethers.utils.parseEther("1");
      const spendAmountUSDC = 50000 * 10 ** 6;

      const approveParams = await approveTokenData(
        "1",
        addresses.USDC,
        (20000 * 10 ** 6).toString()
      );

      const swapParams = await swapTokenData(
        "1",
        addresses.USDC,
        addresses.WETH,
        (20000 * 10 ** 6).toString(),
        gUniRouter.address,
        "50"
      );

      await gUniRouter.rebalanceAndAddLiquidityETH(
        gUniEthPool.address,
        spendAmountUSDC.toString(),
        spendAmountETH,
        (20000 * 10 ** 6).toString(),
        true,
        [approveParams.to, swapParams.to],
        [approveParams.data, swapParams.data],
        0,
        0,
        await user0.getAddress(),
        { value: spendAmountETH }
      );

      const balanceEthAfter = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceEthBefore).to.be.gt(balanceEthAfter);
      expect(balanceUsdcBefore).to.be.gt(balanceUsdcAfter);
      expect(balanceGUniBefore).to.be.lt(balanceGUniAfter);

      /*console.log(
        "ETH deposit:",
        ethers.utils.formatEther(balanceEthBefore.sub(balanceEthAfter))
      );
      console.log(
        "USDC deposit:",
        ethers.utils.formatUnits(balanceUsdcBefore.sub(balanceUsdcAfter), "6")
      );
      console.log("G-UNI minted:", balanceGUniAfter.sub(balanceGUniBefore).toString())*/

      const contractBalanceEth = await daiToken.provider.getBalance(
        gUniRouter.address
      );
      const contractBalanceWeth = await wethToken.balanceOf(gUniRouter.address);
      const contractBalanceUsdc = await usdcToken.balanceOf(gUniRouter.address);
      const contractBalanceG = await gUniToken.balanceOf(gUniRouter.address);

      expect(contractBalanceEth).to.equal(ethers.constants.Zero);
      expect(contractBalanceWeth).to.equal(ethers.constants.Zero);
      expect(contractBalanceUsdc).to.equal(ethers.constants.Zero);
      expect(contractBalanceG).to.equal(ethers.constants.Zero);
    });
  });
  describe("withdrawal through GUniRouter02", function () {
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
    it("should withdraw funds with removeLiquidityETH", async function () {
      const balanceGUniBefore = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );
      expect(balanceGUniBefore).to.be.gt(ethers.constants.Zero);

      const halfBalance = balanceGUniBefore.div("2");
      const balanceEthBefore = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcBefore = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      await gUniEthToken.approve(
        gUniRouter.address,
        ethers.utils.parseEther("10000000")
      );
      await gUniRouter.removeLiquidityETH(
        gUniEthPool.address,
        halfBalance,
        0,
        0,
        await user0.getAddress()
      );
      const balanceEthAfter = await daiToken.provider.getBalance(
        await user0.getAddress()
      );
      const balanceUsdcAfter = await usdcToken.balanceOf(
        await user0.getAddress()
      );
      const balanceGUniAfter = await gUniEthToken.balanceOf(
        await user0.getAddress()
      );

      expect(balanceEthAfter).to.be.gt(balanceEthBefore);
      expect(balanceUsdcAfter).to.be.gt(balanceUsdcBefore);
      expect(balanceGUniBefore).to.be.gt(balanceGUniAfter);
    });
  });
  describe("GUniStaticFactory", function () {
    it("should deploy a pool and renounce manager", async function () {
      const gUniStaticFactory = await ethers.getContractFactory(
        "GUniStaticFactory"
      );

      const gUniStatic = (await gUniStaticFactory.deploy(
        addresses.GUniFactory,
        [gUniPool.address]
      )) as GUniStaticFactory;

      await gUniStatic.createPool(
        addresses.WETH,
        addresses.DAI,
        3000,
        -1200,
        1200
      );

      const oldPool = await gUniStatic.staticPools(0);
      expect(oldPool).to.equal(gUniPool.address);
      const poolAddress = await gUniStatic.staticPools(1);

      const poolContract = (await ethers.getContractAt(
        "IGUniPool",
        poolAddress
      )) as IGUniPool;

      const manager = await poolContract.manager();
      const lower = await poolContract.lowerTick();
      const upper = await poolContract.upperTick();

      expect(manager).to.equal(ethers.constants.AddressZero);
      expect(lower).to.equal(-1200);
      expect(upper).to.equal(1200);
    });
  });
});
