[![CircleCI](https://circleci.com/gh/gelatodigital/uni-v3-lp-periphery/tree/master.svg?style=svg))](https://circleci.com/gh/gelatodigital/uni-v3-lp-periphery/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/gelatodigital/uni-v3-lp-periphery/badge.svg?branch=master&t=IlcAEC)](https://coveralls.io/github/gelatodigital/uni-v3-lp-periphery?branch=master)

# uni-v3-lp-periphery

Router and resolvers for G-UNI LP tokens (ERC20 wrappers of Uniswap V3 LP positions)

# router overview

### addLiquidity

addLiquidity specifying user's amount0Max and amount1Max. Will take the most possible of each token given the composition of the G-UNI position WITHOUT swapping.

```
    function addLiquidity(
        IGUniPool pool,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );
```

Arguments:

- `pool` address of G-UNI pool
- `amount0Max` maximum amount token0 to deposit
- `amount1Max` maximum amount of token1 to deposit
- `amount0Min` minimum amount token0 to deposit (frontrun protection)
- `amount1Min` minimum amount token1 to deposit (frontrun protection)
- `receiver` address who receives minted G-UNI tokens

Returns

- `amount0` amount0 deposited
- `amount1` amount1 deposited
- `mintAmount` amount of G-UNI tokens minted

### addLiquidityETH

same as addLiquidity but send ether as msg.value rather than WETH.

### rebalanceAndAddLiquidity

Like addLiquidity, but before depositing specify a swap so that user's assets are closer to the same proportions as G-UNI position. E.g. If pool is 50% INST and 50% WETH, you can send all WETH and under the hood swap 50% of it for INST before depositing to deposit all or nearly all of user's WETH.

```
    function rebalanceAndAddLiquidity(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        bool zeroForOne,
        uint256 swapAmount,
        uint160 swapThreshold,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        );
```

Arguments:

- `pool` address of G-UNI pool
- `amount0In` amount token0 initially forwarded by user
- `amount1In` amount token1 initially forwarded by user
- `zeroForOne` direction of swap (swapping token0 for token1 or reverse)
- `swapAmount` amount to input into the swap
- `swapThreshold` slippage parameter of v3 swap (encoded as a sqrtPriceX96)
- `amount0Min` minimum amount token0 to deposit (frontrun protection)
- `amount1Min` minimum amount token1 to deposit (frontrun protection)
- `receiver` address who receives minted G-UNI tokens

Returns

- `amount0` amount0 deposited
- `amount1` amount1 deposited
- `mintAmount` amount of G-UNI tokens minted

### rebalanceAndAddLiquidityETH

same as rebalanceAndAddLiquidity but forward ether in msg.value rather than WETH.

### removeLiquidity

```
    function removeLiquidity(
        IGUniPool pool,
        uint256 burnAmount,
        uint256 amount0Min,
        uint256 amount1Min,
        address receiver
    )
        external
        returns (
            uint256 amount0,
            uint256 amount1,
            uint128 liquidityBurned
        );
```

Arguments:

- `pool` address of G-UNI pool
- `burnAmount` amount of G-UNI tokens to burn
- `amount0Min` minimum amount token0 remitted (frontrun protection)
- `amount1Min` minimum amount token1 remitted (frontrun protection)
- `receiver` address who receives minted G-UNI tokens

Returns

- `amount0` amount0 deposited
- `amount1` amount1 deposited
- `liquidityBurned` amount of liquidity removed from G-UNI position

### removeLiquidityETH

same as removeLiquidity, but WETH is unwrapped before remitted to receiver.

# test

yarn

yarn test
