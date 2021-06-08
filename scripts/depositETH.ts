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
  const uniPool = await ethers.getContractAt(
    "IUniswapV3Pool",
    addresses.WethDaiV3Pool,
    signer
  );

  const weth = await ethers.getContractAt(
    ["function approve(address,uint256) external"],
    addresses.WETH,
    signer
  );
  const dai = await ethers.getContractAt(
    ["function approve(address,uint256) external"],
    addresses.DAI,
    signer
  );

  // @dev change these amounts to your needs
  await weth.approve(router.address, ethers.utils.parseEther("10000"));
  await dai.approve(router.address, ethers.utils.parseEther("2000000"));
  const { sqrtPriceX96 } = await uniPool.slot0();
  const slippagePrice = sqrtPriceX96.add(
    sqrtPriceX96.div(ethers.BigNumber.from("10"))
  );
  await router.rebalanceAndAddLiquidityETH(
    addresses.GUNIWethDai,
    0,
    ethers.utils.parseEther("0.5"),
    false,
    ethers.utils.parseEther("0.25"),
    slippagePrice,
    0,
    0,
    await signer.getAddress(),
    {
      gasLimit: 1000000,
      value: ethers.utils.parseEther("0.5"),
    }
  );
};

(async () => {
  const [signer] = await ethers.getSigners();
  await op(signer);
})();
