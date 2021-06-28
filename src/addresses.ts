/* eslint-disable @typescript-eslint/naming-convention */
interface Addresses {
  Gelato: string;
  Swapper: string;
  GelatoAdmin: string;
  UniswapV3Factory: string;
  WETH: string;
  DAI: string;
  USDC: string;
  GUniRouter: string;
  GUniResolver: string;
  GUniFactory: string;
}

export const getAddresses = (network: string): Addresses => {
  switch (network) {
    case "mainnet":
      return {
        Gelato: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
        Swapper: "",
        GelatoAdmin: "0x163407FDA1a93941358c1bfda39a868599553b6D",
        UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        GUniRouter: "0x8CA6fa325bc32f86a12cC4964Edf1f71655007A7",
        USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        GUniResolver: "0x3B01f3534c9505fE8e7cf42794a545A0d2ede976",
        GUniFactory: "",
      };
    case "ropsten":
      return {
        Gelato: "0xCc4CcD69D31F9FfDBD3BFfDe49c6aA886DaB98d9",
        UniswapV3Factory: "0x273Edaa13C845F605b5886Dd66C89AB497A6B17b",
        Swapper: "0x2E185412E2aF7DC9Ed28359Ea3193EBAd7E929C6",
        GelatoAdmin: "0xD90fC89e89E3E5b75256b5aA617f887C583b29a2",
        WETH: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        DAI: "0xaD6D458402F60fD3Bd25163575031ACDce07538D",
        GUniRouter: "0xfC35A62Ede6f49A4e5A03cf134d6989a17BAa55C",
        USDC: "",
        GUniResolver: "0xAE9D90e23538Be0c8Cad559B2b97F67bF87cb93b",
        GUniFactory: "0xDC012b00bc522E7a09D00Ad08D001a17D0A23493",
      };
    default:
      throw new Error(`No addresses for Network: ${network}`);
  }
};
