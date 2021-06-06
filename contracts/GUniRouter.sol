// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import {IGUniRouter} from "./interfaces/IGUniRouter.sol";
import {IGUniPool} from "./interfaces/IGUniPool.sol";
import {IUniswapV3Pool} from "./interfaces/IUniswapV3Pool.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {
    IERC20,
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {
    IUniswapV3SwapCallback
} from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "hardhat/console.sol";

contract GUniRouter is IGUniRouter, IUniswapV3SwapCallback {
    using Address for address payable;
    using SafeERC20 for IERC20;
    IWETH public immutable weth;
    IUniswapV3Pool private _pool;

    constructor(IWETH _weth) {
        weth = _weth;
    }

    // solhint-disable-next-line code-complexity
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        require(msg.sender == address(_pool));
        address sender = abi.decode(data, (address));
        if (sender == address(this)) {
            if (amount0Delta > 0)
                IERC20(_pool.token0()).safeTransfer(
                    msg.sender,
                    uint256(amount0Delta)
                );
            else if (amount1Delta > 0)
                IERC20(_pool.token1()).safeTransfer(
                    msg.sender,
                    uint256(amount1Delta)
                );
        } else {
            if (amount0Delta > 0)
                IERC20(_pool.token0()).safeTransferFrom(
                    sender,
                    msg.sender,
                    uint256(amount0Delta)
                );
            else if (amount1Delta > 0) {
                IERC20(_pool.token1()).safeTransferFrom(
                    sender,
                    msg.sender,
                    uint256(amount1Delta)
                );
            }
        }
    }

    function addLiquidity(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
    {
        (amount0, amount1, mintAmount) = pool.getMintAmounts(
            amount0Max,
            amount1Max
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );
        if (amount0 > 0) {
            pool.token0().safeTransferFrom(msg.sender, address(this), amount0);
            pool.token0().safeIncreaseAllowance(address(pool), amount0);
        }
        if (amount1 > 0) {
            pool.token1().safeTransferFrom(msg.sender, address(this), amount1);
            pool.token1().safeIncreaseAllowance(address(pool), amount1);
        }
        pool.mint(amount0, amount1);
        IERC20(address(pool)).safeTransfer(msg.sender, mintAmount);
    }

    // solhint-disable-next-line code-complexity, function-max-lines
    function addLiquidityETH(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        payable
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
    {
        (amount0, amount1, mintAmount) = pool.getMintAmounts(
            amount0Max,
            amount1Max
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );

        if (address(pool.token0()) == address(weth)) {
            require(
                amount0Max == msg.value,
                "mismatching amount of ETH forwarded"
            );
            if (amount0 > 0) {
                weth.deposit{value: amount0}();
                pool.token0().safeIncreaseAllowance(address(pool), amount0);
            }
            if (amount0Max - amount0 > 0) {
                payable(msg.sender).sendValue(amount0Max - amount0);
            }
            if (amount1 > 0) {
                pool.token1().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount1
                );
                pool.token1().safeIncreaseAllowance(address(pool), amount1);
            }
        } else if (address(pool.token1()) == address(weth)) {
            require(
                amount1Max == msg.value,
                "mismatching amount of ETH forwarded"
            );
            if (amount1 > 0) {
                weth.deposit{value: amount1}();
                pool.token1().safeIncreaseAllowance(address(pool), amount1);
            }
            if (amount1Max - amount1 > 0) {
                payable(msg.sender).sendValue(amount1Max - amount1);
            }
            if (amount0 > 0) {
                pool.token0().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount0
                );
                pool.token0().safeIncreaseAllowance(address(pool), amount0);
            }
        } else {
            revert("one pool token must be WETH");
        }

        pool.mint(amount0, amount1);
        IERC20(address(pool)).safeTransfer(msg.sender, mintAmount);
    }

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
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
    {
        (uint256 amount0Final, uint256 amount1Final) =
            _rebalance(pool, _amount0, _amount1, swapAmount, swapThreshold);
        (amount0, amount1, mintAmount) = pool.getMintAmounts(
            amount0Final,
            amount1Final
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );
        if (amount0 > 0) {
            pool.token0().safeTransferFrom(msg.sender, address(this), amount0);
            pool.token0().safeIncreaseAllowance(address(pool), amount0);
        }
        if (amount1 > 0) {
            pool.token1().safeTransferFrom(msg.sender, address(this), amount1);
            pool.token1().safeIncreaseAllowance(address(pool), amount1);
        }
        (amount0, amount1, mintAmount) = pool.mint(amount0, amount1);
        IERC20(address(pool)).safeTransfer(msg.sender, mintAmount);
    }

    // solhint-disable-next-line function-max-lines
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
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
    {
        (
            uint256 amount0Final,
            uint256 amount1Final,
            uint256 amountETHLeft,
            bool wethToken0
        ) = _rebalanceETH(pool, _amount0, _amount1, swapAmount, swapThreshold);

        (amount0, amount1, mintAmount) = pool.getMintAmounts(
            amount0Final,
            amount1Final
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );

        _depositRebalancedAddLiquidityETH(
            pool,
            amount0,
            amount1,
            mintAmount,
            amountETHLeft,
            wethToken0
        );
    }

    function removeLiquidity(
        IGUniPool pool,
        uint256 _burnAmount,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 burnAmount
        )
    {
        IERC20(address(pool)).safeTransferFrom(
            msg.sender,
            address(this),
            _burnAmount
        );
        (amount0, amount1, burnAmount) = pool.burn(_burnAmount);
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "received below minimum"
        );
        if (amount0 > 0) {
            pool.token0().safeTransfer(msg.sender, amount0);
        }
        if (amount1 > 0) {
            pool.token1().safeTransfer(msg.sender, amount1);
        }
    }

    // solhint-disable-next-line code-complexity, function-max-lines
    function removeLiquidityETH(
        IGUniPool pool,
        uint256 _burnAmount,
        uint256 amount0Min,
        uint256 amount1Min
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 burnAmount
        )
    {
        bool wethToken0;
        if (address(pool.token0()) == address(weth)) {
            wethToken0 = true;
        } else if (address(pool.token1()) == address(weth)) {
            wethToken0 = false;
        } else {
            revert("one pool token must be WETH");
        }

        IERC20(address(pool)).safeTransferFrom(
            msg.sender,
            address(this),
            _burnAmount
        );
        (amount0, amount1, burnAmount) = pool.burn(_burnAmount);
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "received below minimum"
        );

        if (wethToken0) {
            if (amount0 > 0) {
                weth.withdraw(amount0);
                payable(msg.sender).sendValue(amount0);
            }
            if (amount1 > 0) {
                pool.token1().safeTransfer(msg.sender, amount1);
            }
        } else {
            if (amount1 > 0) {
                weth.withdraw(amount1);
                payable(msg.sender).sendValue(amount1);
            }
            if (amount0 > 0) {
                pool.token0().safeTransfer(msg.sender, amount0);
            }
        }
    }

    function _rebalance(
        IGUniPool pool,
        uint256 _amount0,
        uint256 _amount1,
        uint256 swapAmount,
        uint160 swapThreshold
    ) internal returns (uint256 amount0, uint256 amount1) {
        IUniswapV3Pool uniPool = pool.pool();
        _pool = uniPool;
        (uint160 sqrtRatioX96, , , , , , ) = uniPool.slot0();
        (int256 amount0Delta, int256 amount1Delta) =
            uniPool.swap(
                msg.sender,
                swapThreshold < sqrtRatioX96 ? true : false,
                int256(swapAmount),
                swapThreshold,
                abi.encode(msg.sender)
            );
        amount0 = uint256(int256(_amount0) - amount0Delta);
        amount1 = uint256(int256(_amount1) - amount1Delta);
    }

    // solhint-disable-next-line function-max-lines
    function _rebalanceETH(
        IGUniPool pool,
        uint256 _amount0,
        uint256 _amount1,
        uint256 swapAmount,
        uint160 swapThreshold
    )
        internal
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 amountETHLeft,
            bool wethToken0
        )
    {
        IUniswapV3Pool uniPool = pool.pool();
        _pool = uniPool;
        (uint160 sqrtRatioX96, , , , , , ) = uniPool.slot0();

        bool swappingETH;
        if (address(pool.token0()) == address(weth)) {
            require(
                _amount0 == msg.value,
                "mismatching amount of ETH forwarded"
            );
            swappingETH = swapThreshold < sqrtRatioX96;
            wethToken0 = true;
        } else if (address(pool.token1()) == address(weth)) {
            require(
                _amount1 == msg.value,
                "mismatching amount of ETH forwarded"
            );
            swappingETH = swapThreshold > sqrtRatioX96;
        } else {
            revert("one pool token must be WETH");
        }

        if (swappingETH) {
            amountETHLeft = msg.value - swapAmount;
            weth.deposit{value: swapAmount}();
            (int256 amount0Delta, int256 amount1Delta) =
                uniPool.swap(
                    msg.sender,
                    swapThreshold < sqrtRatioX96 ? true : false,
                    int256(swapAmount),
                    swapThreshold,
                    abi.encode(address(this))
                );
            amount0 = uint256(int256(_amount0) - amount0Delta);
            amount1 = uint256(int256(_amount1) - amount1Delta);
        } else {
            amountETHLeft = msg.value;
            (int256 amount0Delta, int256 amount1Delta) =
                uniPool.swap(
                    address(this),
                    swapThreshold < sqrtRatioX96 ? true : false,
                    int256(swapAmount),
                    swapThreshold,
                    abi.encode(msg.sender)
                );
            amount0 = uint256(int256(_amount0) - amount0Delta);
            amount1 = uint256(int256(_amount1) - amount1Delta);
        }
    }

    // solhint-disable-next-line code-complexity
    function _depositRebalancedAddLiquidityETH(
        IGUniPool pool,
        uint256 amount0,
        uint256 amount1,
        uint256 mintAmount,
        uint256 amountETHLeft,
        bool wethToken0
    ) internal {
        uint256 wethAmount = wethToken0 ? amount0 : amount1;
        uint256 otherAmount = wethToken0 ? amount1 : amount0;
        uint256 wethBalance = IERC20(address(weth)).balanceOf(address(this));
        if (wethAmount > wethBalance) {
            weth.deposit{value: wethAmount - wethBalance}();
            amountETHLeft -= wethAmount - wethBalance;
        }
        if (amountETHLeft > 0) {
            payable(msg.sender).sendValue(amountETHLeft);
        }
        if (otherAmount > 0 && wethToken0) {
            pool.token1().safeTransferFrom(msg.sender, address(this), amount1);
            pool.token1().safeIncreaseAllowance(address(pool), amount1);
        } else if (otherAmount > 0) {
            pool.token0().safeTransferFrom(msg.sender, address(this), amount0);
            pool.token0().safeIncreaseAllowance(address(pool), amount0);
        }

        if (wethAmount > 0) {
            IERC20(address(weth)).safeIncreaseAllowance(
                address(pool),
                wethAmount
            );
        }

        pool.mint(amount0, amount1);
        IERC20(address(pool)).safeTransfer(msg.sender, mintAmount);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
