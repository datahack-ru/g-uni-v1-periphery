import { expect } from "chai";
import { ethers, network } from "hardhat";
import { IERC20, GUniResolver02, GUniRouter02, IGUniPool } from "../typechain";
import fetch from "node-fetch";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddresses } from "../src/addresses";
import { any } from "hardhat/internal/core/params/argumentTypes";

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

describe("Compound bug test", function () {
  this.timeout(0);
  //let user1: SignerWithAddress;
  let meSigner: any;
  let comptroller: any;
  let comp: IERC20;
  let me: string;
  //let pool: IUniswapV3Pool;
  before(async function () {
    const [user] = await ethers.getSigners();
    comptroller = (await ethers.getContractAt(["function claimComp(address,address[]) external"], "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B"));

    me = "0x4E2572d9161Fc58743A4622046Ca30a1fB538670";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [me],
    });
    meSigner = await ethers.provider.getSigner(me);
    comp = (await ethers.getContractAt("IERC20", "0xc00e94cb662c3520282e6f5717214004a7f26888")) as IERC20;
    await user.sendTransaction({
      to: me,
      value: ethers.utils.parseEther("1")
    });
  });

  describe("Claim COMP Test", function () {
    it("checks comp claim", async function () {
      const currentBal = await comp.balanceOf(me)
      console.log(currentBal.toString())
      console.log("calling...")
      const tx = await comptroller.connect(meSigner).claimComp(
        me,
        [ "0x12392F67bdf24faE0AF363c24aC620a2f67DAd86",
          "0x39AA39c021dfbaE8faC545936693aC917d5E7563",
          "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5",
          "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
          "0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E",
          "0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4",
          "0xccF4429DB6322D5C611ee964527D42E5d685DD6a",
          "0xFAce851a4921ce59e912d19329929CE6da6EB0c7"
        ]
      );
      console.log("call succeeded:", tx.hash)
      const currentBalAfter = await comp.balanceOf(me)
      console.log(currentBalAfter.toString())
    });
  });
});
