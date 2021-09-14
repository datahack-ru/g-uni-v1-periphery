[![CircleCI](https://circleci.com/gh/gelatodigital/g-uni-v1-periphery/tree/master.svg?style=svg)](https://circleci.com/gh/gelatodigital/g-uni-v1-periphery/tree/master)

# g-uni-v1-periphery

Peripheral Contracts for G-UNI LP tokens (ERC20 wrappers of Uniswap V3 LP positions)

# GUniRouter02 overview

### addLiquidity

Add liquidity by specifying user's amount0Max and amount1Max. Will take the most possible of each token given the composition of the G-UNI position WITHOUT swapping any tokens. No guarantees of how much token0 or token1 will actually be utilized only within range `amountMin <= amount <= amountMax`

msg.sender must approve router to spend amount0Max and amount1Max before calling this method.

```
    /// @notice addLiquidity adds liquidity to G-UNI pool of interest (mints G-UNI LP tokens)
    /// @param _pool address of G-UNI pool to add liquidity to
    /// @param _amount0Max the maximum amount of token0 msg.sender willing to input
    /// @param _amount1Max the maximum amount of token1 msg.sender willing to input
    /// @param _amount0Min the minimum amount of token0 actually input (slippage protection)
    /// @param _amount1Min the minimum amount of token1 actually input (slippage protection)
    /// @param _receiver account to receive minted G-UNI tokens
    /// @return amount0 amount of token0 transferred from msg.sender to mint `mintAmount`
    /// @return amount1 amount of token1 transferred from msg.sender to mint `mintAmount`
    /// @return mintAmount amount of G-UNI tokens minted and transferred to `receiver`
    function addLiquidity(
        IGUniPool _pool,
        uint256 _amount0Max,
        uint256 _amount1Max,
        uint256 _amount0Min,
        uint256 _amount1Min,
        address _receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
```

### addLiquidityETH

Same as `addLiquidity` method but accepts and handles ETH deposits rather than WETH for UniswapV3 pairs with WETH

```
    /// @notice addLiquidityETH same as addLiquidity but expects ETH transfers (instead of WETH)
    // solhint-disable-next-line code-complexity, function-max-lines
    function addLiquidityETH(
        IGUniPool _pool,
        uint256 _amount0Max,
        uint256 _amount1Max,
        uint256 _amount0Min,
        uint256 _amount1Min,
        address _receiver
    )
        external
        payable
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
```

### rebalanceAndAddLiquidity

Similar to `addLiquidity` method, but before depositing specify a swap so that user's assets are closer to the same proportions as G-UNI position. E.g. If pool is 50% INST and 50% WETH, you can send only WETH and under the hood swap 50% of it for INST before depositing. Goal is to deposit all or nearly all of user's original investment by swapping.

1inch swaps are expected here, with the address and payload generated from 1inch off-chain apis. These publicly exposed apis generate data for token approval calls and swap calls. Standard behavior would be to fill \_swapActions and \_swapDatas with two elements each (approve address/data and swap address/data)

```
    /// @notice rebalanceAndAddLiquidity accomplishes same task as addLiquidity/addLiquidityETH
    /// but we rebalance msg.sender's holdings (perform a swap) before adding liquidity.
    /// @param _pool address of G-UNI pool to add liquidity to
    /// @param _amount0In the amount of token0 msg.sender forwards to router
    /// @param _amount1In the amount of token1 msg.sender forwards to router
    /// @param _amountSwap amount to input into swap
    /// @param _zeroForOne directionality of swap
    /// @param _swapActions addresses for swap calls
    /// @param _swapDatas payloads for swap calls
    /// @param _amount0Min the minimum amount of token0 actually deposited (slippage protection)
    /// @param _amount1Min the minimum amount of token1 actually deposited (slippage protection)
    /// @param _receiver account to receive minted G-UNI tokens
    /// @return amount0 amount of token0 actually deposited into pool
    /// @return amount1 amount of token1 actually deposited into pool
    /// @return mintAmount amount of G-UNI tokens minted and transferred to `receiver`
    /// @dev note on swaps: MUST swap to/from token0 from/to token1 as specified by zeroForOne
    /// will revert on "overshot" swap (receive more outToken from swap than can be deposited)
    /// swapping for erroneous tokens will not necessarily revert in all cases
    /// and could result in loss of funds so be careful with swapActions and swapDatas params.
    // solhint-disable-next-line function-max-lines
    function rebalanceAndAddLiquidity(
        IGUniPool _pool,
        uint256 _amount0In,
        uint256 _amount1In,
        uint256 _amountSwap,
        bool _zeroForOne,
        address[] memory _swapActions,
        bytes[] memory _swapDatas,
        uint256 _amount0Min,
        uint256 _amount1Min,
        address _receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
```

### rebalanceAndAddLiquidityETH

Same as `rebalanceAndAddLiquidity` method, but accepts and handles ETH deposits for UniswapV3 pairs with WETH. Note that swaps must either be token->WETH or ETH->token. When inputting ETH into a swap no approve transaction is necessary so \_swapActions and \_swapDatas should be length 1 arrays (as opposed to 2 when swapping an ERC20 token that needs to be approved)

```
    /// @notice rebalanceAndAddLiquidityETH same as rebalanceAndAddLiquidity
    /// except this function expects ETH transfer (instead of WETH)
    /// @dev note on swaps: MUST swap either ETH -> token or token->WETH
    /// swaps which try to execute token -> ETH instead of WETH will revert
    // solhint-disable-next-line function-max-lines, code-complexity
    function rebalanceAndAddLiquidityETH(
        IGUniPool _pool,
        uint256 _amount0In,
        uint256 _amount1In,
        uint256 _amountSwap,
        bool _zeroForOne,
        address[] memory _swapActions,
        bytes[] memory _swapDatas,
        uint256 _amount0Min,
        uint256 _amount1Min,
        address _receiver
    )
        external
        payable
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 mintAmount
        )
```

### removeLiquidity

Remove liquidity from G-UNI pool by burning G-UNI tokens and receive the underlying assets.

msg.sender must approve router to spend burnAmount of G-UNI tokens.

```
    /// @notice removeLiquidity removes liquidity from a G-UNI pool and burns G-UNI LP tokens
    /// @param _pool address of G-UNI pool to remove liquidity from
    /// @param _burnAmount The number of G-UNI tokens to burn
    /// @param _amount0Min Minimum amount of token0 received after burn (slippage protection)
    /// @param _amount1Min Minimum amount of token1 received after burn (slippage protection)
    /// @param _receiver The account to receive the underlying amounts of token0 and token1
    /// @return amount0 actual amount of token0 transferred to receiver for burning `burnAmount`
    /// @return amount1 actual amount of token1 transferred to receiver for burning `burnAmount`
    /// @return liquidityBurned amount of liquidity removed from the underlying Uniswap V3 position
    function removeLiquidity(
        IGUniPool _pool,
        uint256 _burnAmount,
        uint256 _amount0Min,
        uint256 _amount1Min,
        address _receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint128 liquidityBurned
        )
```

### removeLiquidityETH

Same as `removeLiquidity`, but WETH is unwrapped before remitted to receiver.

```
    /// @notice removeLiquidityETH same as removeLiquidity
    /// except this function unwraps WETH and sends ETH to receiver account
    // solhint-disable-next-line code-complexity, function-max-lines
    function removeLiquidityETH(
        IGUniPool _pool,
        uint256 _burnAmount,
        uint256 _amount0Min,
        uint256 _amount1Min,
        address payable _receiver
    )
        external
        override
        returns (
            uint256 amount0,
            uint256 amount1,
            uint128 liquidityBurned
        )
```

# GUniResolver02

### getRebalanceParams

If you are performing a rebalanceAndAddliquidity call, how do you know how much asset you should swap to end up with the right proportion of asset0 and asset1 to deposit maximum liquidity possible? Use this helper method to generate the estimate for the swap parameters.

```
    function getRebalanceParams(
        IGUniPool pool,
        uint256 amount0In,
        uint256 amount1In,
        uint256 price18Decimals
    ) external view override returns (bool zeroForOne, uint256 swapAmount) {
```

Arguments:

- `pool` address of G-UNI pool
- `amount0In` amount of asset 0 user wants to deposit
- `amount1In` amount of asset 1 user wants to deposit
- `price18Decimals` price of token1/token0 as 18 decimal value

Returns:

- `zeroForOne` boolean specifying which asset to input for swap
- `swapAmount` amount of asset to input for swap

# test

yarn

yarn test
