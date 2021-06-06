// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import {IGUniPool} from "./IGUniPool.sol";

interface IGUniRouter {
    function addLiquidity(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );

    function addLiquidityETH(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        payable
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );

    function rebalanceAndAddLiquidity(
        IGUniPool pool,
        uint256 _amount0,
        uint256 _amount1,
        uint256 swapAmount,
        uint160 swapThreshold,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );

    function rebalanceAndAddLiquidityETH(
        IGUniPool pool,
        uint256 _amount0,
        uint256 _amount1,
        uint256 swapAmount,
        uint160 swapThreshold,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        payable
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );

    function removeLiquidity(
        IGUniPool pool,
        uint256 _burnAmount,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 burnAmount
        );

    function removeLiquidityETH(
        IGUniPool pool,
        uint256 _burnAmount,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 burnAmount
        );
}
