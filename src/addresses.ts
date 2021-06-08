/* eslint-disable @typescript-eslint/naming-convention */
interface Addresses {
  Gelato: string;
  GUNIWethDai: string;
  Swapper: string;
  GelatoAdmin: string;
  WethDaiV3Pool: string;
  UniswapFactory: string;
  WETH: string;
  DAI: string;
  GUNIRouter: string;
}

export const getAddresses = (network: string): Addresses => {
  switch (network) {
    case "mainnet":
      return {
        Gelato: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
        GUNIWethDai: "0x810F9C4613f466F02cC7Da671a3ba9a7e8c33c69",
        Swapper: "",
        GelatoAdmin: "0x163407FDA1a93941358c1bfda39a868599553b6D",
        WethDaiV3Pool: "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        UniswapFactory: "",
        WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        GUNIRouter: "",
      };
    case "ropsten":
      return {
        Gelato: "0xCc4CcD69D31F9FfDBD3BFfDe49c6aA886DaB98d9",
        WethDaiV3Pool: "0x25D0Ea8FAc3Ce2313c6a478DA92e0ccf95213B1A",
        UniswapFactory: "0x273Edaa13C845F605b5886Dd66C89AB497A6B17b",
        GUNIWethDai: "0x706ce812d30463b3ACD61Ff933A44c4c6109675f",
        Swapper: "0x2E185412E2aF7DC9Ed28359Ea3193EBAd7E929C6",
        GelatoAdmin: "0xD90fC89e89E3E5b75256b5aA617f887C583b29a2",
        WETH: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        DAI: "0xaD6D458402F60fD3Bd25163575031ACDce07538D",
        GUNIRouter: "0xfC35A62Ede6f49A4e5A03cf134d6989a17BAa55C",
      };
    default:
      throw new Error(`No addresses for Network: ${network}`);
  }
};
