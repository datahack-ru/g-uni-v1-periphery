import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress) => {
  const router = await ethers.getContractAt(
    "GUniRouter",
    addresses.GUniRouter,
    signer
  );
  const resolver = await ethers.getContractAt(
    "GUniResolver",
    addresses.GUniResolver,
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

  const gUniFactory = await ethers.getContractAt(
    [
      "function getPoolAddress(address, address, address, uint24) external view returns(address)",
    ],
    addresses.GUniFactory,
    signer
  );

  const gUniPoolAddress = await gUniFactory.getPoolAddress(
    await signer.getAddress(),
    addresses.WETH,
    addresses.DAI,
    3000
  );

  console.log("gUniPoolAddress:", gUniPoolAddress);

  // @dev change these amounts to your needs
  await weth.approve(router.address, ethers.utils.parseEther("10000"));
  await dai.approve(router.address, ethers.utils.parseEther("2000000"));

  const amountETH = ethers.utils.parseEther("0.1");

  const {
    zeroForOne: isZeroForOne,
    swapAmount,
    swapThreshold,
  } = await resolver.getRebalanceParams(gUniPoolAddress, 0, amountETH, 1000);

  if (Number(ethers.utils.formatEther(swapAmount)) == 0) {
    console.log("calling addLiquidityETH...");
    await router.addLiquidityETH(
      gUniPoolAddress,
      0,
      amountETH,
      0,
      0,
      await signer.getAddress(),
      {
        gasLimit: 600000,
        value: amountETH,
      }
    );
  } else {
    console.log("calling rebalanceAndAddLiquidityETH...");
    await router.rebalanceAndAddLiquidityETH(
      gUniPoolAddress,
      0,
      amountETH,
      isZeroForOne,
      swapAmount,
      swapThreshold,
      0,
      0,
      await signer.getAddress(),
      {
        gasLimit: 800000,
        value: amountETH,
      }
    );
  }
};

(async () => {
  const [signer] = await ethers.getSigners();
  await op(signer);
})();
