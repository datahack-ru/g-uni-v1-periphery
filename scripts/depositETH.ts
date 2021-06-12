import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress) => {
  const router = await ethers.getContractAt(
    "GUniRouter",
    addresses.GUNIRouter,
    signer
  );
  const resolver = await ethers.getContractAt(
    "GUniResolver",
    addresses.GUNIResolver,
    signer
  );

  /*const weth = await ethers.getContractAt(
    ["function approve(address,uint256) external"],
    addresses.WETH,
    signer
  );
  const usdc = await ethers.getContractAt(
    ["function approve(address,uint256) external"],
    addresses.USDC,
    signer
  );

  // @dev change these amounts to your needs
  await weth.approve(router.address, ethers.utils.parseEther("10000"));
  await usdc.approve(router.address, ethers.utils.parseEther("2000000"));
  const { sqrtPriceX96 } = await uniPool.slot0();
  const slippagePrice = sqrtPriceX96.add(
    sqrtPriceX96.div(ethers.BigNumber.from("20"))
  );*/

  const amountETH = ethers.utils.parseEther("0.4");

  const {
    zeroForOne: isZeroForOne,
    swapAmount,
    swapThreshold,
  } = await resolver.getRebalanceParams(
    addresses.GUNIWethUsdc,
    0,
    amountETH,
    100
  );
  await router.rebalanceAndAddLiquidityETH(
    addresses.GUNIWethUsdc,
    0,
    amountETH,
    isZeroForOne,
    swapAmount,
    swapThreshold,
    0,
    0,
    await signer.getAddress(),
    {
      gasLimit: 600000,
      value: amountETH,
    }
  );
};

(async () => {
  const [signer] = await ethers.getSigners();
  await op(signer);
})();
