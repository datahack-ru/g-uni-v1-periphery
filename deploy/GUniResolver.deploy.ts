import { deployments, getNamedAccounts } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (
    hre.network.name === "mainnet" ||
    hre.network.name === "rinkeby" ||
    hre.network.name === "ropsten"
  ) {
    console.log(
      `!! Deploying GUniResolver to mainnet/testnet. Hit ctrl + c to abort`
    );
    await new Promise((r) => setTimeout(r, 20000));
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("GUniResolver", {
    from: deployer,
  });
};

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const shouldSkip =
    hre.network.name === "mainnet" ||
    hre.network.name === "rinkeby" ||
    hre.network.name === "ropsten";
  return shouldSkip ? true : false;
};

func.tags = ["GUniResolver"];

export default func;
