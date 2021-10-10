// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import {IGUniFactory} from "./interfaces/IGUniFactory.sol";
import {IGUniPool} from "./interfaces/IGUniPool.sol";

contract GUniStaticFactory {
    IGUniFactory public immutable factory;
    uint256 public nextPoolIndex;
    mapping(uint256 => address) public staticPools;

    constructor(IGUniFactory _factory, address[] memory _existingPools) {
        factory = _factory;
        for (uint256 i = 0; i < _existingPools.length; i++) {
            staticPools[i] = _existingPools[i];
        }
        nextPoolIndex = _existingPools.length;
    }

    function createPool(
        address _tokenA,
        address _tokenB,
        uint24 _uniFee,
        int24 _lowerTick,
        int24 _upperTick
    ) external returns (address pool) {
        _validateTickSpacing(_uniFee, _lowerTick, _upperTick);

        pool = factory.createPool(
            _tokenA,
            _tokenB,
            _uniFee,
            0,
            _lowerTick,
            _upperTick
        );

        IGUniPool(pool).renounceOwnership();

        staticPools[nextPoolIndex] = pool;
        nextPoolIndex += 1;
    }

    function _validateTickSpacing(
        uint24 _uniFee,
        int24 _lowerTick,
        int24 _upperTick
    ) internal pure {
        if (_uniFee == 10000) {
            require(
                _lowerTick % 200 == 0 && _upperTick % 200 == 0,
                "wrong tick spacing"
            );
        } else if (_uniFee == 3000) {
            require(
                _lowerTick % 60 == 0 && _upperTick % 60 == 0,
                "wrong tick spacing"
            );
        } else if (_uniFee == 500) {
            require(
                _lowerTick % 10 == 0 && _upperTick % 10 == 0,
                "wrong tick spacing"
            );
        } else {
            revert("unrecognized fee tier");
        }
    }
}
