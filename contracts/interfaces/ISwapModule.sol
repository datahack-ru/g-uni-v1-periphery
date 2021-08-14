// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface ISwapModule {
    function swap(address[] memory _swapActions, bytes[] memory _swapDatas)
        external;
}
