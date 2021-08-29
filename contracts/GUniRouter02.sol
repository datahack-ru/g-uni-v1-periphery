// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import {IGUniRouter02} from "./interfaces/IGUniRouter02.sol";
import {IGUniPool} from "./interfaces/IGUniPool.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {
    IERC20,
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {GelatoBytes} from "./vendor/gelato/GelatoBytes.sol";

contract GUniRouter02 is IGUniRouter02 {
    using Address for address payable;
    using SafeERC20 for IERC20;

    IWETH public immutable weth;

    constructor(IWETH _weth) {
        weth = _weth;
    }

    /// @notice addLiquidity adds liquidity to G-UNI pool of interest (mints G-UNI LP tokens)
    /// @param pool address of G-UNI pool to add liquidity to
    /// @param amount0Max the maximum amount of token0 msg.sender willing to input
    /// @param amount1Max the maximum amount of token1 msg.sender willing to input
    /// @param amount0Min the minimum amount of token0 actually input (slippage protection)
    /// @param amount1Min the minimum amount of token1 actually input (slippage protection)
    /// @param receiver account to receive minted G-UNI tokens
    /// @return amount0 amount of token0 transferred from msg.sender to mint `mintAmount`
    /// @return amount1 amount of token1 transferred from msg.sender to mint `mintAmount`
    /// @return mintAmount amount of G-UNI tokens minted and transferred to `receiver`
    function addLiquidity(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
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
        }
        if (amount1 > 0) {
            pool.token1().safeTransferFrom(msg.sender, address(this), amount1);
        }

        _deposit(pool, amount0, amount1, mintAmount, receiver);
    }

    /// @notice addLiquidityETH same as addLiquidity but expects ETH transfers (instead of WETH)
    // solhint-disable-next-line code-complexity, function-max-lines
    function addLiquidityETH(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
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
        uint256 preBalance = address(this).balance - msg.value;
        (amount0, amount1, mintAmount) = pool.getMintAmounts(
            amount0Max,
            amount1Max
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );

        if (isToken0Weth(address(pool.token0()), address(pool.token1()))) {
            require(
                amount0Max == msg.value,
                "mismatching amount of ETH forwarded"
            );
            if (amount0 > 0) {
                weth.deposit{value: amount0}();
            }
            if (amount1 > 0) {
                pool.token1().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount1
                );
            }
        } else {
            require(
                amount1Max == msg.value,
                "mismatching amount of ETH forwarded"
            );
            if (amount1 > 0) {
                weth.deposit{value: amount1}();
            }
            if (amount0 > 0) {
                pool.token0().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount0
                );
            }
        }

        _deposit(pool, amount0, amount1, mintAmount, receiver);

        if (address(this).balance > preBalance) {
            payable(msg.sender).sendValue(address(this).balance - preBalance);
        }
    }

    /// @notice rebalanceAndAddLiquidity accomplishes same task as addLiquidity/addLiquidityETH
    /// but we rebalance msg.sender's holdings (perform a swap) before adding liquidity.
    /// @param pool address of G-UNI pool to add liquidity to
    /// @param amount0In the amount of token0 msg.sender forwards to router
    /// @param amount1In the amount of token1 msg.sender forwards to router
    /// @param amountSwap amount to input into swap
    /// @param zeroForOne directionality of swap
    /// @param swapActions addresses for swap calls
    /// @param swapDatas payloads for swap calls
    /// @param amount0Min the minimum amount of token0 actually deposited (slippage protection)
    /// @param amount1Min the minimum amount of token1 actually deposited (slippage protection)
    /// @param receiver account to receive minted G-UNI tokens
    /// @return amount0 amount of token0 actually deposited into pool
    /// @return amount1 amount of token1 actually deposited into pool
    /// @return mintAmount amount of G-UNI tokens minted and transferred to `receiver`
    /// @dev note on swaps: MUST swap to/from token0 from/to token1 as specified by zeroForOne
    /// will revert on "overshot" swap (receive more outToken from swap than can be deposited)
    /// swapping for erroneous tokens will not necessarily revert in all cases
    /// and could result in loss of funds so be careful with swapActions and swapDatas params.
    // solhint-disable-next-line function-max-lines
    function rebalanceAndAddLiquidity(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amountSwap,
        bool zeroForOne,
        address[] memory swapActions,
        bytes[] memory swapDatas,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
    {
        (amount0, amount1, mintAmount) = _prepareRebalanceDeposit(
            pool,
            amount0In,
            amount1In,
            amountSwap,
            zeroForOne,
            swapActions,
            swapDatas
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );

        _deposit(pool, amount0, amount1, mintAmount, receiver);
    }

    /// @notice rebalanceAndAddLiquidityETH same as rebalanceAndAddLiquidity
    /// except this function expects ETH transfer (instead of WETH)
    /// @dev note on swaps: MUST swap either ETH -> token or token->WETH
    /// swaps which try to execute token -> ETH instead of WETH will revert
    // solhint-disable-next-line function-max-lines, code-complexity
    function rebalanceAndAddLiquidityETH(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amountSwap,
        bool zeroForOne,
        address[] memory swapActions,
        bytes[] memory swapDatas,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
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
        uint256 preBalance = address(this).balance - msg.value;
        (amount0, amount1, mintAmount) = _prepareRebalanceDepositETH(
            pool,
            amount0In,
            amount1In,
            amountSwap,
            zeroForOne,
            swapActions,
            swapDatas
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "below min amounts"
        );

        _deposit(pool, amount0, amount1, mintAmount, receiver);

        if (address(this).balance > preBalance) {
            payable(msg.sender).sendValue(address(this).balance - preBalance);
        }
    }

    /// @notice removeLiquidity removes liquidity from a G-UNI pool and burns G-UNI LP tokens
    /// @param burnAmount The number of G-UNI tokens to burn
    /// @param amount0Min Minimum amount of token0 received after burn (slippage protection)
    /// @param amount1Min Minimum amount of token1 received after burn (slippage protection)
    /// @param receiver The account to receive the underlying amounts of token0 and token1
    /// @return amount0 actual amount of token0 transferred to receiver for burning `burnAmount`
    /// @return amount1 actual amount of token1 transferred to receiver for burning `burnAmount`
    /// @return liquidityBurned amount of liquidity removed from the underlying Uniswap V3 position
    function removeLiquidity(
        IGUniPool pool,
        uint256 burnAmount,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint128 liquidityBurned
        )
    {
        IERC20(address(pool)).safeTransferFrom(
            msg.sender,
            address(this),
            burnAmount
        );
        (amount0, amount1, liquidityBurned) = pool.burn(burnAmount, receiver);
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "received below minimum"
        );
    }

    /// @notice removeLiquidityETH same as removeLiquidity
    /// except this function unwraps WETH and sends ETH to receiver account
    // solhint-disable-next-line code-complexity, function-max-lines
    function removeLiquidityETH(
        IGUniPool pool,
        uint256 burnAmount,
        uint256 amount0Min,
        uint256 amount1Min,
        address payable receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint128 liquidityBurned
        )
    {
        bool wethToken0 =
            isToken0Weth(address(pool.token0()), address(pool.token1()));

        IERC20(address(pool)).safeTransferFrom(
            msg.sender,
            address(this),
            burnAmount
        );
        (amount0, amount1, liquidityBurned) = pool.burn(
            burnAmount,
            address(this)
        );
        require(
            amount0 >= amount0Min && amount1 >= amount1Min,
            "received below minimum"
        );

        if (wethToken0) {
            if (amount0 > 0) {
                weth.withdraw(amount0);
                receiver.sendValue(amount0);
            }
            if (amount1 > 0) {
                pool.token1().safeTransfer(receiver, amount1);
            }
        } else {
            if (amount1 > 0) {
                weth.withdraw(amount1);
                receiver.sendValue(amount1);
            }
            if (amount0 > 0) {
                pool.token0().safeTransfer(receiver, amount0);
            }
        }
    }

    function _deposit(
        IGUniPool pool,
        uint256 amount0,
        uint256 amount1,
        uint256 mintAmount,
        address receiver
    ) internal {
        if (amount0 > 0) {
            pool.token0().safeIncreaseAllowance(address(pool), amount0);
        }
        if (amount1 > 0) {
            pool.token1().safeIncreaseAllowance(address(pool), amount1);
        }

        (uint256 amount0Check, uint256 amount1Check, ) =
            pool.mint(mintAmount, receiver);
        require(
            amount0 == amount0Check && amount1 == amount1Check,
            "unexpected amounts deposited"
        );
    }

    function _prepareRebalanceDeposit(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amountSwap,
        bool zeroForOne,
        address[] memory swapActions,
        bytes[] memory swapDatas
    )
        internal
        returns (
            uint256 amount0Use,
            uint256 amount1Use,
            uint256 mintAmount
        )
    {
        if (zeroForOne) {
            pool.token0().safeTransferFrom(
                msg.sender,
                address(this),
                amountSwap
            );
            amount0In = amount0In - amountSwap;
        } else {
            pool.token1().safeTransferFrom(
                msg.sender,
                address(this),
                amountSwap
            );
            amount1In = amount1In - amountSwap;
        }

        _swap(pool, 0, zeroForOne, swapActions, swapDatas);

        (amount0Use, amount1Use, mintAmount) = _postSwap(
            pool,
            amount0In,
            amount1In
        );
    }

    // solhint-disable-next-line function-max-lines
    function _prepareRebalanceDepositETH(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amountSwap,
        bool zeroForOne,
        address[] memory swapActions,
        bytes[] memory swapDatas
    )
        internal
        returns (
            uint256 amount0Use,
            uint256 amount1Use,
            uint256 mintAmount
        )
    {
        bool wethToken0 =
            isToken0Weth(address(pool.token0()), address(pool.token1()));

        if (zeroForOne) {
            if (wethToken0) {
                require(
                    amount0In == msg.value,
                    "mismatching amount of ETH forwarded"
                );
            } else {
                pool.token0().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amountSwap
                );
            }
            amount0In = amount0In - amountSwap;
        } else {
            if (wethToken0) {
                pool.token1().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amountSwap
                );
            } else {
                require(
                    amount1In == msg.value,
                    "mismatching amount of ETH forwarded"
                );
            }
            amount1In = amount1In - amountSwap;
        }

        _swap(
            pool,
            wethToken0 == zeroForOne ? amountSwap : 0,
            zeroForOne,
            swapActions,
            swapDatas
        );

        (amount0Use, amount1Use, mintAmount) = _postSwapETH(
            pool,
            amount0In,
            amount1In,
            wethToken0
        );
    }

    function _swap(
        IGUniPool pool,
        uint256 ethValue,
        bool zeroForOne,
        address[] memory swapActions,
        bytes[] memory swapDatas
    ) internal {
        require(
            swapActions.length == swapDatas.length,
            "swap actions length != swap datas length"
        );
        uint256 balanceBefore =
            zeroForOne
                ? pool.token1().balanceOf(address(this))
                : pool.token0().balanceOf(address(this));
        if (ethValue > 0 && swapActions.length == 1) {
            (bool success, bytes memory returnsData) =
                swapActions[0].call{value: ethValue}(swapDatas[0]);
            if (!success) GelatoBytes.revertWithError(returnsData, "swap: ");
        } else {
            for (uint256 i; i < swapActions.length; i++) {
                (bool success, bytes memory returnsData) =
                    swapActions[i].call(swapDatas[i]);
                if (!success)
                    GelatoBytes.revertWithError(returnsData, "swap: ");
            }
        }
        uint256 balanceAfter =
            zeroForOne
                ? pool.token1().balanceOf(address(this))
                : pool.token0().balanceOf(address(this));
        require(balanceAfter > balanceBefore, "swap for incorrect token");
    }

    function _postSwap(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In
    )
        internal
        returns (
            uint256 amount0Use,
            uint256 amount1Use,
            uint256 mintAmount
        )
    {
        uint256 balance0 = pool.token0().balanceOf(address(this));
        uint256 balance1 = pool.token1().balanceOf(address(this));

        (amount0Use, amount1Use, mintAmount) = pool.getMintAmounts(
            amount0In + balance0,
            amount1In + balance1
        );
        require(
            amount1Use >= balance1 && amount0Use >= balance0,
            "swap overshot"
        );

        if (amount0Use - balance0 > 0) {
            pool.token0().safeTransferFrom(
                msg.sender,
                address(this),
                amount0Use - balance0
            );
        }
        if (amount1Use - balance1 > 0) {
            pool.token1().safeTransferFrom(
                msg.sender,
                address(this),
                amount1Use - balance1
            );
        }
    }

    // solhint-disable-next-line code-complexity, function-max-lines
    function _postSwapETH(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        bool wethToken0
    )
        internal
        returns (
            uint256 amount0Use,
            uint256 amount1Use,
            uint256 mintAmount
        )
    {
        uint256 balance0 = pool.token0().balanceOf(address(this));
        uint256 balance1 = pool.token1().balanceOf(address(this));

        (amount0Use, amount1Use, mintAmount) = pool.getMintAmounts(
            amount0In + balance0,
            amount1In + balance1
        );
        require(
            amount1Use >= balance1 && amount0Use >= balance0,
            "swap overshot"
        );

        if (amount0Use - balance0 > 0) {
            if (wethToken0) {
                weth.deposit{value: amount0Use - balance0}();
            } else {
                pool.token0().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount0Use - balance0
                );
            }
        }
        if (amount1Use - balance1 > 0) {
            if (wethToken0) {
                pool.token1().safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount1Use - balance1
                );
            } else {
                weth.deposit{value: amount1Use - balance1}();
            }
        }
    }

    function isToken0Weth(address token0, address token1)
        public
        view
        returns (bool wethToken0)
    {
        if (token0 == address(weth)) {
            wethToken0 = true;
        } else if (token1 == address(weth)) {
            wethToken0 = false;
        } else {
            revert("one pool token must be WETH");
        }
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
