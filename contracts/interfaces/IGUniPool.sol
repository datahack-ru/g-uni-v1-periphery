// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

interface IGUniPool {
    function token0() external view returns (IERC20);

    function token1() external view returns (IERC20);

    function pool() external view returns (IUniswapV3Pool);

    function mint(uint256 amount0Max, uint256 amount1Max)
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );

    function burn(uint256 _burnAmount)
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint128 liquidityBurned
        );

    function getMintAmounts(uint256 amount0Max, uint256 amount1Max)
        external
        view
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );
}