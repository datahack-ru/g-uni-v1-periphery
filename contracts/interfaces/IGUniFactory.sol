// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

interface IGUniFactory {
    function createPool(
        address tokenA,
        address tokenB,
        uint24 uniFee,
        uint16 managerFee,
        int24 lowerTick,
        int24 upperTick
    ) external returns (address pool);
}
