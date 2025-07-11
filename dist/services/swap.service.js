import { Contract, parseUnits, formatUnits, ZeroAddress, ethers } from 'ethers';
import { CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';
import { Trade, Pair, Route } from '@uniswap/v2-sdk';
export class SwapService {
    constructor(provider, config) {
        this.config = config;
        this.signer = null;
        this.pairs = [];
        this.resolvePairsLoaded = null;
        this.provider = provider;
        this.wethAddress = config.wethAddress;
        this.chainId = config.chainId;
        // Router ABI for swap functions
        const routerAbi = [
            'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
            'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
            'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
            'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
            'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
            'function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut)',
            'function WETH() external pure returns (address)'
        ];
        // Factory ABI for pair operations
        const factoryAbi = [
            'function getPair(address tokenA, address tokenB) external view returns (address pair)',
            'function allPairs(uint) external view returns (address pair)',
            'function allPairsLength() external view returns (uint)'
        ];
        this.routerContract = new Contract(config.routerAddress, routerAbi, provider);
        this.factoryContract = new Contract(config.factoryAddress, factoryAbi, provider);
        this.pairsLoadedPromise = new Promise((resolve) => {
            this.resolvePairsLoaded = resolve;
        });
        this.loadAllPairsFromGraph(config.graphEndpoint);
    }
    setSigner(signer) {
        this.signer = signer;
        // Connect the signer to the router contract for transaction execution
        this.routerContract = this.routerContract.connect(signer);
    }
    /**
     * Rounds a number string to the specified number of decimal places
     * to avoid parseUnits errors with too many decimals
     */
    roundToDecimals(value, decimals) {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return '0';
        }
        return num.toFixed(decimals);
    }
    /**
     * Loads all pairs from The Graph and caches them as Uniswap SDK Pair instances.
     * @param graphEndpoint The GraphQL endpoint URL
     */
    async loadAllPairsFromGraph(graphEndpoint) {
        // Query for pairs with token info and reserves
        const query = `{
      pairs(first: 1000) {
        id
        reserve0
        reserve1
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
      }
    }`;
        try {
            const response = await fetch(graphEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!response.ok)
                throw new Error(`Network error: ${response.status}`);
            const { data } = await response.json();
            if (!data || !data.pairs)
                return;
            const pairs = [];
            for (const pair of data.pairs) {
                pairs.push(this.createSDKPair(pair));
            }
            this.pairs = pairs;
            // Find the WETH token from the pairs and set wethToken to a new Token instance if found
            const wethPair = data.pairs.find((pair) => pair.token0.id.toLowerCase() === this.wethAddress.toLowerCase() ||
                pair.token1.id.toLowerCase() === this.wethAddress.toLowerCase());
            if (wethPair) {
                const tokenData = wethPair.token0.id.toLowerCase() === this.wethAddress.toLowerCase()
                    ? wethPair.token0
                    : wethPair.token1;
                this.wethToken = {
                    address: tokenData.id,
                    symbol: tokenData.symbol,
                    name: tokenData.name,
                    decimals: Number(tokenData.decimals),
                };
            }
            else {
                throw new Error('No weth token found');
            }
            if (this.resolvePairsLoaded) {
                this.resolvePairsLoaded();
                this.resolvePairsLoaded = null;
            }
        }
        catch (error) {
            console.error('Error loading pairs from graph:', error);
            if (this.resolvePairsLoaded) {
                this.resolvePairsLoaded(); // resolve anyway to avoid deadlock
                this.resolvePairsLoaded = null;
            }
        }
    }
    async waitForPairsLoaded() {
        return await this.pairsLoadedPromise;
    }
    createSDKPair(pair) {
        const { token0, token1, id, reserve0, reserve1 } = pair;
        const sdkToken0 = new Token(this.chainId, token0.id, Number(token0.decimals), token0.symbol, token0.name);
        const sdkToken1 = new Token(this.chainId, token1.id, Number(token1.decimals), token1.symbol, token1.name);
        let reserve0BN;
        let reserve1BN;
        if (reserve0 && reserve1) {
            reserve0BN = parseUnits(reserve0, Number(token0.decimals));
            reserve1BN = parseUnits(reserve1, Number(token1.decimals));
        }
        else {
            throw new Error('No reserves data');
        }
        const amount0 = CurrencyAmount.fromRawAmount(sdkToken0, reserve0BN.toString());
        const amount1 = CurrencyAmount.fromRawAmount(sdkToken1, reserve1BN.toString());
        const sdkPair = new Pair(amount0, amount1);
        return sdkPair;
    }
    /**
     * Returns the cached pairs for use in routing.
     */
    getPairs() {
        return this.pairs;
    }
    /**
     * Finds the best trade path using Uniswap SDK for a given input amount.
     * Returns the best path as an array of addresses, or null if no trade found.
     */
    async getBestTradePath(fromToken, toToken, amountInWei) {
        // Create Uniswap SDK Token instances
        const sdkFromToken = new Token(this.chainId, fromToken.address, fromToken.decimals, fromToken.symbol, fromToken.name);
        const sdkToToken = new Token(this.chainId, toToken.address, toToken.decimals, toToken.symbol, toToken.name);
        // Create currency amount
        const currencyAmount = CurrencyAmount.fromRawAmount(sdkFromToken, amountInWei);
        await this.waitForPairsLoaded();
        const pairs = this.getPairs();
        if (!pairs || pairs.length === 0) {
            throw new Error('Pairs not loaded yet. Please wait for initialization.');
        }
        const trades = Trade.bestTradeExactIn(pairs, currencyAmount, sdkToToken, {
            maxHops: 4,
            maxNumResults: 3,
        });
        if (trades.length > 0) {
            const bestTrade = trades[0];
            return bestTrade.route.path.map((token) => token.address);
        }
        else {
            return null;
        }
    }
    async calculateExpectedOutput(sellToken, buyToken, amountIn) {
        try {
            // Round the input amount to avoid parseUnits errors
            const roundedAmountIn = this.roundToDecimals(amountIn, sellToken.decimals);
            const sellAmountWei = parseUnits(roundedAmountIn, sellToken.decimals);
            // Get the best path
            const bestPath = await this.getBestTradePath(sellToken.address == ethers.ZeroAddress ? this.wethToken : sellToken, buyToken.address == ethers.ZeroAddress ? this.wethToken : buyToken, sellAmountWei.toString());
            if (!bestPath) {
                throw new Error('No trade path found for the given tokens and amount.');
            }
            // Use routerContract to get expected output
            const amountsOut = await this.routerContract.getAmountsOut(sellAmountWei, bestPath);
            const expectedOutput = amountsOut[amountsOut.length - 1];
            // Convert bigint to human-readable string
            const expectedOutputHumanReadable = formatUnits(expectedOutput.toString(), buyToken.decimals);
            return {
                amount: expectedOutputHumanReadable,
                path: bestPath,
            };
        }
        catch (error) {
            console.error('Error calculating expected output:', error);
            throw error;
        }
    }
    async checkApproval(tokenAddress, amount, spenderAddress) {
        try {
            const tokenContract = new Contract(tokenAddress, ['function allowance(address,address) view returns (uint256)'], this.provider);
            const signerAddress = await this.signer?.getAddress();
            if (!signerAddress) {
                throw new Error('Signer not available');
            }
            const allowance = await tokenContract.allowance(signerAddress, spenderAddress);
            const amountWei = parseUnits(amount, 18); // Assuming 18 decimals for approval check
            return allowance >= amountWei;
        }
        catch (error) {
            console.error('Error checking approval:', error);
            return false;
        }
    }
    async approveToken(tokenAddress, spenderAddress, amount) {
        if (!this.signer) {
            throw new Error('Signer not set');
        }
        try {
            const tokenContract = new Contract(tokenAddress, ['function approve(address,uint256) returns (bool)'], this.signer);
            const amountWei = parseUnits(amount, 18);
            const tx = await tokenContract.approve(spenderAddress, amountWei);
            const receipt = await tx.wait();
            return receipt.hash;
        }
        catch (error) {
            console.error('Error approving token:', error);
            throw error;
        }
    }
    async swapTokens(fromToken, toToken, amountInWei, amountOutMinWei, path, deadline, settings) {
        if (!this.signer) {
            throw new Error('Signer not set');
        }
        try {
            // Round the amounts to the appropriate decimal precision to avoid parseUnits errors
            const deadlineTimestamp = Math.floor(Date.now() / 1000) + (deadline * 60);
            let tx;
            const signerAddress = await this.signer.getAddress();
            // If fromToken is not native, check allowance and approve if needed
            if (fromToken.address !== ethers.ZeroAddress) {
                const tokenContract = new Contract(fromToken.address, ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'], this.signer);
                const allowance = await tokenContract.allowance(signerAddress, this.config.routerAddress);
                if (allowance < amountInWei) {
                    // Approve MaxUint256 for router
                    const approveTx = await tokenContract.approve(this.config.routerAddress, ethers.MaxUint256);
                    await approveTx.wait();
                }
            }
            if (fromToken.address === ethers.ZeroAddress) {
                // Swap ETH for tokens
                tx = await this.routerContract.swapExactETHForTokens(amountOutMinWei, path, signerAddress, deadlineTimestamp, { value: amountInWei });
            }
            else if (toToken.address === ethers.ZeroAddress) {
                // Swap tokens for ETH
                tx = await this.routerContract.swapExactTokensForETH(amountInWei, amountOutMinWei, path, signerAddress, deadlineTimestamp);
            }
            else {
                // Swap tokens for tokens
                tx = await this.routerContract.swapExactTokensForTokens(amountInWei, amountOutMinWei, path, signerAddress, deadlineTimestamp);
            }
            const receipt = await tx.wait();
            return receipt.hash;
        }
        catch (error) {
            console.error('Error swapping tokens:', error);
            throw error;
        }
    }
    async getPairAddress(tokenA, tokenB) {
        try {
            return await this.factoryContract.getPair(tokenA, tokenB);
        }
        catch (error) {
            console.error('Error getting pair address:', error);
            throw error;
        }
    }
    async checkLiquidityExists(tokenA, tokenB) {
        try {
            const pairAddress = await this.getPairAddress(tokenA, tokenB);
            return pairAddress !== ZeroAddress;
        }
        catch (error) {
            console.error('Error checking liquidity:', error);
            return false;
        }
    }
    // Uniswap SDK methods for advanced trading
    async createTrade(fromToken, toToken, amountIn, slippageTolerance = 0.5) {
        try {
            // Create Token instances for Uniswap SDK
            const fromTokenInstance = new Token(this.chainId, fromToken.address, fromToken.decimals, fromToken.symbol, fromToken.name);
            const toTokenInstance = new Token(this.chainId, toToken.address, toToken.decimals, toToken.symbol, toToken.name);
            // Create currency amount
            const currencyAmount = CurrencyAmount.fromRawAmount(fromTokenInstance, parseUnits(amountIn, fromToken.decimals).toString());
            // Get pair data
            const pairAddress = await this.getPairAddress(fromToken.address, toToken.address);
            if (pairAddress === ZeroAddress) {
                throw new Error('No liquidity pair found');
            }
            // Create pair instance
            const pair = new Pair(CurrencyAmount.fromRawAmount(fromTokenInstance, '0'), CurrencyAmount.fromRawAmount(toTokenInstance, '0'));
            // Create route
            const route = new Route([pair], fromTokenInstance, toTokenInstance);
            // Create trade
            const trade = new Trade(route, currencyAmount, TradeType.EXACT_INPUT);
            return trade;
        }
        catch (error) {
            console.error('Error creating trade:', error);
            throw error;
        }
    }
    /**
     * Fetch tokens from the graph endpoint (subgraph)
     * @param graphEndpoint The GraphQL endpoint URL
     * @param search Optional search string for symbol or name
     */
    async getTokensFromGraph(graphEndpoint, search) {
        const query = `{
      tokens(first: 100, where: {
        ${search ? `or: [
          { symbol_contains_nocase: \"${search}\" }
          { name_contains_nocase: \"${search}\" }
        ]` : ''}
      }) {
        id
        symbol
        name
        decimals
      }
    }`;
        try {
            const response = await fetch(graphEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!response.ok)
                throw new Error(`Network error: ${response.status}`);
            const { data } = await response.json();
            if (!data || !data.tokens)
                return [];
            return data.tokens.map((token) => ({
                address: token.id,
                symbol: token.symbol,
                name: token.name,
                decimals: Number(token.decimals),
            }));
        }
        catch (error) {
            console.error('Error fetching tokens from graph:', error);
            return [];
        }
    }
}
//# sourceMappingURL=swap.service.js.map