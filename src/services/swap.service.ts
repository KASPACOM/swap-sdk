import { BigNumberish, Contract, Signer, BrowserProvider, JsonRpcProvider, parseUnits, formatUnits, ZeroAddress, ethers, hexlify, ContractTransactionResponse, TransactionResponse } from 'ethers';
import { Currency, CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core';
import { Trade, Pair, Route } from '@uniswap/v2-sdk';
import { ComputedAmounts, Erc20Token, KaspaComSdkPair, KaspaComSdkToken, SwapSdkNetworkConfig, SwapSdkOptions } from '../types';
import { CustomFeePair } from '../types/CustomFeePair';

export const PARTNER_FEE_BPS_DIVISOR = 10_000n;

export class SwapService {
  private provider: BrowserProvider | JsonRpcProvider;
  private signer: Signer | null = null;
  protected routerContract: Contract;
  protected factoryContract: Contract;
  protected proxyContract?: Contract;
  protected chainId: number;
  protected pairs: Pair[] = [];
  protected tokensByAddress: { [tokenAddress: string]: KaspaComSdkToken } = {};
  protected pairsLoadedPromise: Promise<void>;
  protected resolvePairsLoaded: (() => void) | null = null;
  protected rejectPairsLoaded: ((error: any) => void) | null = null;
  protected partnerFeeLoadedPromise: Promise<void>;
  protected resolvePartnerFeeLoaded: (() => void) | null = null;
  protected rejectPartnerFeeLoaded: ((error: any) => void) | null = null;
  protected partnerFee: bigint = 0n;

  constructor(
    provider: BrowserProvider | JsonRpcProvider,
    private config: SwapSdkNetworkConfig,
    private swapOptions: SwapSdkOptions,
  ) {
    this.provider = provider;
    this.chainId = config.chainId;
    this.routerContract = new Contract(config.routerAddress, this.routerAbi, provider);
    this.factoryContract = new Contract(config.factoryAddress, this.factoryAbi, provider);

    if (config.proxyAddress) {
      this.proxyContract = new Contract(config.proxyAddress, this.proxyAbi, provider);
    }

    this.pairsLoadedPromise = new Promise((resolve, reject) => {
      this.resolvePairsLoaded = resolve;
      this.rejectPairsLoaded = reject;
    });

    this.partnerFeeLoadedPromise = new Promise((resolve, reject) => {
      this.resolvePartnerFeeLoaded = resolve;
      this.rejectPartnerFeeLoaded = reject;
    });
    this.loadAllPairs();
    this.loadPartnerFee();
  }

  protected get routerContractFunctionNames(): {
    swapExactTokensForTokens: string;
    swapTokensForExactTokens: string;
    swapExactETHForTokens: string;
    swapETHForExactTokens: string;
    swapExactTokensForETH: string;
    swapTokensForExactETH: string;
  } {
    return {
      swapExactTokensForTokens: 'swapExactTokensForTokens',
      swapTokensForExactTokens: 'swapTokensForExactTokens',
      swapExactETHForTokens: 'swapExactETHForTokens',
      swapETHForExactTokens: 'swapETHForExactTokens',
      swapExactTokensForETH: 'swapExactTokensForETH',
      swapTokensForExactETH: 'swapTokensForExactETH',

    }
  }

  protected get routerAbi() {
    return [
      // Swaps (ERC20 <-> ERC20)
      `function ${this.routerContractFunctionNames.swapExactTokensForTokens}(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)`,
      `function ${this.routerContractFunctionNames.swapTokensForExactTokens}(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)`,

      // Swaps (ETH <-> ERC20)
      `function ${this.routerContractFunctionNames.swapExactETHForTokens}(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)`,
      `function ${this.routerContractFunctionNames.swapETHForExactTokens}(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)`,
      `function ${this.routerContractFunctionNames.swapExactTokensForETH}(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)`,
      `function ${this.routerContractFunctionNames.swapTokensForExactETH}(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)`,

      // Get Amounts
      `function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)`,
      `function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut)`,
      `function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn)`,
      `function getAmountsIn(uint amountOut, address[] memory path) internal view returns (uint[] memory amounts)`,

      // Get WETH
      `function WETH() external pure returns (address)`
    ];
  }

  protected get factoryAbi() {
    return [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)'
    ];
  }

  protected get proxyAbi() {
    return [
      ...this.routerAbi,
      "function partners(bytes32) external view returns (address feeRecipient, uint16 feeBps)"
    ]
  }

  // parnter fee is BPS_DIVISOR = 10_000n;
  async loadPartnerFee(): Promise<bigint> {
    if (!this.resolvePairsLoaded) {
      return this.partnerFee;
    }
    try {
      if (this.swapOptions.partnerKey && this.proxyContract) {
        const [, fee] = await this.proxyContract?.partners(this.swapOptions.partnerKey);
        this.partnerFee = fee;
      }


      if (this.resolvePartnerFeeLoaded) {
        this.resolvePartnerFeeLoaded();
        this.resolvePartnerFeeLoaded = null;
      }

      return this.partnerFee;
    } catch (error) {
      if (this.rejectPartnerFeeLoaded) {
        this.rejectPartnerFeeLoaded(error);
        this.partnerFeeLoadedPromise = new Promise((resolve, reject) => {
          this.resolvePartnerFeeLoaded = resolve;
          this.rejectPartnerFeeLoaded = reject;
        })
      }
      throw error;
    }

  }

  setSigner(signer: Signer): void {
    this.signer = signer;
    // Connect the signer to the router contract for transaction execution
    this.routerContract = this.routerContract.connect(signer) as Contract;

    if (this.proxyContract) {
      this.proxyContract = this.proxyContract.connect(signer) as Contract;
    }
  }

  /**
   * Rounds a number string to the specified number of decimal places
   * to avoid parseUnits errors with too many decimals
   */
  private roundToDecimals(value: string, decimals: number): string {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return '0';
    }
    return num.toFixed(decimals);
  }

  async refreshPairsFromBackend(): Promise<KaspaComSdkPair[]> {
    const response = await fetch(`${this.config.badckendApiUrl}/dex/graph-pairs?network=${this.config.defiApiNetworkName}`, {
      method: 'GET',
    });
    if (!response.ok) throw new Error(`Network error: ${response.status}`);
    const data = await response.json();
    if (!data) throw new Error(`No pairs found: ${data}`);

    return data;
  }

  async refreshPairs(): Promise<void> {
    const pairsResult = this.swapOptions.getPairsData ? await this.swapOptions.getPairsData() : await this.refreshPairsFromBackend();

    const pairs: Pair[] = [];
    for (const pair of pairsResult) {
      pairs.push(
        this.createSDKPair(pair)
      );
    }
    this.pairs = pairs;
    this.tokensByAddress = pairsResult.reduce((acc, pair) => {
      acc[pair.token0.id.toLowerCase()] = pair.token0;
      acc[pair.token1.id.toLowerCase()] = pair.token1;
      return acc;
    }, {} as { [address: string]: KaspaComSdkToken });
  }

  /**
   * Loads all pairs from The Graph and caches them as Uniswap SDK Pair instances.
   * @param graphEndpoint The GraphQL endpoint URL
   */
  protected async loadAllPairs(): Promise<void> {
    try {
      await this.refreshPairs();

      if (this.resolvePairsLoaded) {
        this.resolvePairsLoaded();
        this.resolvePairsLoaded = null;
      }
    } catch (error) {
      console.error('Error loading pairs from graph:', error);
      if (this.rejectPairsLoaded) {
        this.rejectPairsLoaded(error as any); // resolve anyway to avoid deadlock
      }

      this.pairsLoadedPromise = new Promise((resolve, reject) => {
        this.resolvePairsLoaded = resolve;
        this.rejectPairsLoaded = reject;
      });

      setTimeout(this.loadAllPairs.bind(this), 1000);
    }
  }

  public async waitForPairsLoaded(): Promise<void> {
    return await this.pairsLoadedPromise;
  }

  public async waitForPartnerFeeLoaded(): Promise<void> {
    return await this.partnerFeeLoadedPromise;
  }

  createSDKPair(pair: KaspaComSdkPair): Pair {
    const { token0, token1, reserve0, reserve1 } = pair;

    const sdkToken0 = new Token(
      this.chainId,
      token0.id,
      Number(token0.decimals),
      token0.symbol,
      token0.name,
    );

    const sdkToken1 = new Token(
      this.chainId,
      token1.id,
      Number(token1.decimals),
      token1.symbol,
      token1.name,
    );

    let reserve0BN: BigNumberish;
    let reserve1BN: BigNumberish;

    if (reserve0 && reserve1) {
      reserve0BN = parseUnits(reserve0, Number(token0.decimals));
      reserve1BN = parseUnits(reserve1, Number(token1.decimals));
    } else {
      throw new Error('No reserves data')
    }

    const amount0 = CurrencyAmount.fromRawAmount(
      sdkToken0,
      reserve0BN.toString(),
    );

    const amount1 = CurrencyAmount.fromRawAmount(
      sdkToken1,
      reserve1BN.toString(),
    );

    const sdkPair = new CustomFeePair(amount0, amount1);
    return sdkPair;
  }

  /**
   * Returns the cached pairs for use in routing.
   */
  public getPairs(): Pair[] {
    return this.pairs;
  }

  /**
   * Finds the best trade path using Uniswap SDK for a given input amount.
   * Returns the best path as an array of addresses, or null if no trade found.
   */
  private async getBestTrade(
    fromToken: Erc20Token,
    toToken: Erc20Token,
    amountInWei: string,
    isOutputAmount?: boolean,
  ): Promise<Trade<Currency, Currency, TradeType.EXACT_INPUT> | Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null> {

    // Create Uniswap SDK Token instances
    const sdkFromToken = new Token(
      this.chainId,
      fromToken.address,
      fromToken.decimals,
      fromToken.symbol,
      fromToken.name,
    );

    const sdkToToken = new Token(
      this.chainId,
      toToken.address,
      toToken.decimals,
      toToken.symbol,
      toToken.name,
    );

    // Create currency amount
    const currencyAmount = CurrencyAmount.fromRawAmount(
      isOutputAmount ? sdkToToken : sdkFromToken,
      amountInWei,
    );

    const pairs = this.getPairs();
    if (!pairs || pairs.length === 0) {
      throw new Error('Pairs not loaded yet. Please wait for initialization.');
    }

    const tradeConfig = {
      maxHops: this.swapOptions.maxHops || 3,
      maxNumResults: 1,
    };

    const trades = isOutputAmount ?
      Trade.bestTradeExactOut(pairs, sdkFromToken, currencyAmount, tradeConfig)
      : Trade.bestTradeExactIn(
        pairs,
        currencyAmount,
        sdkToToken,
        tradeConfig,
      );

    if (trades.length > 0) {
      return trades[0];
    } else {
      return null;
    }
  }

  private trimTrailingZeros(value: string): string {
    if (!value.includes('.')) return value; // no decimals

    // Remove trailing zeros after decimal
    value = value.replace(/\.?0+$/, '');

    return value;
  }

  protected async getAmountsIn(sellAmountWei: bigint, pathAddresses: string[]): Promise<bigint> {
    const [aIn] = await this.routerContract.getAmountsIn(sellAmountWei, pathAddresses);
    return aIn;
  }

  protected async getAmountsOut(buyAmountWei: bigint, pathAddresses: string[]): Promise<bigint> {
    const results = await this.routerContract.getAmountsOut(buyAmountWei, pathAddresses);
    return results[results.length - 1];
  }

  /**
   * 
   * @param sellToken 
   * @param buyToken 
   * @param targetAmount 
   * @param isOutputAmount true if user input output (How much tokens to receive) and not input (how much tokens to sell)
   * @param slippage 
   * @returns 
   */
  async calculateTrade(
    sellToken: Erc20Token,
    buyToken: Erc20Token,
    targetAmount: string,
    isOutputAmount: boolean,
    slippage: string,
  ): Promise<{
    trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | Trade<Currency, Currency, TradeType.EXACT_OUTPUT>,
    computed: ComputedAmounts,
  }> {
    try {
      await this.waitForPairsLoaded();
      await this.waitForPartnerFeeLoaded();

      // Round the input amount to avoid parseUnits errors
      const roundedAmountIn = this.roundToDecimals(targetAmount, isOutputAmount ? buyToken.decimals : sellToken.decimals);

      let sellAmountWei = parseUnits(
        roundedAmountIn,
        isOutputAmount ? buyToken.decimals : sellToken.decimals,
      );

      if (isOutputAmount && this.partnerFee && this.partnerFee > 0n) {
        // For Exact receice - Add partner fee to the final result
        const numerator = sellAmountWei * PARTNER_FEE_BPS_DIVISOR;
        const denominator = PARTNER_FEE_BPS_DIVISOR - this.partnerFee;

        // Use ceiling division to avoid rounding down
        sellAmountWei = (numerator + denominator - 1n) / denominator;
      }

      const sellTokenForContracts = sellToken.address == ethers.ZeroAddress ? this.config.wrappedToken : sellToken;
      const buyTokenForContracts = buyToken.address == ethers.ZeroAddress ? this.config.wrappedToken : buyToken;

      // Get the best path
      const trade = await this.getBestTrade(
        sellTokenForContracts,
        buyTokenForContracts,
        sellAmountWei.toString(),
        isOutputAmount,
      );


      if (!trade) {
        throw new Error('No trade path found for the given tokens and amount.');
      }

      const pathAddresses = trade.route.path.map(token => token.address);

      let amountIn: string = '0';
      let amountOut: string = '0';

      if (isOutputAmount) {
        amountIn = String(await this.getAmountsIn(sellAmountWei, pathAddresses));
        amountOut = String(parseUnits(targetAmount, buyToken.decimals));
      } else {
        amountOut = String(await this.getAmountsOut(sellAmountWei, pathAddresses));
        amountIn = String(parseUnits(targetAmount, sellToken.decimals));
      }

      let amounts: ComputedAmounts = {
        amountIn: formatUnits(amountIn, sellToken.decimals),
        amountOut: isOutputAmount ? this.trimTrailingZeros(roundedAmountIn) : formatUnits(amountOut, buyToken.decimals),
        amountInRaw: amountIn,
        amountOutRaw: amountOut,
      };

      const slippagePercent = new Percent(Math.round(parseFloat(slippage) * 100), 10000);

      let maxAmountIn, minAmountOut;

      if (isOutputAmount) {
        const slippageAmount = BigInt(amountIn) * BigInt(slippagePercent.numerator.toString()) / BigInt(slippagePercent.denominator.toString());
        const maxAmountInBigInt = BigInt(amountIn) + slippageAmount;
        maxAmountIn = maxAmountInBigInt.toString();
        amounts.maxAmountInRaw = maxAmountIn;
        amounts.maxAmountIn = formatUnits(maxAmountIn, sellToken.decimals);
      } else {
        const amountOutBigInt = BigInt(amountOut);
        const slippageAmount = amountOutBigInt * BigInt(slippagePercent.numerator.toString()) / BigInt(slippagePercent.denominator.toString());
        const minAmountOutBigInt = amountOutBigInt - slippageAmount;
        minAmountOut = minAmountOutBigInt.toString();
        amounts.minAmountOutRaw = minAmountOut;
        amounts.minAmountOut = formatUnits(minAmountOut, buyToken.decimals);
      }

      if (this.partnerFee && this.partnerFee > 0n) {
        if (!isOutputAmount) {
          // ---- Exact input: remove partner fee from amountOut ----
          const amountOutBigInt = BigInt(amountOut);
          const amountOutMinusFee = (amountOutBigInt * (PARTNER_FEE_BPS_DIVISOR - this.partnerFee)) / PARTNER_FEE_BPS_DIVISOR;

          amounts.amountOutRaw = amountOutMinusFee.toString();
          amounts.amountOut = formatUnits(amountOutMinusFee, buyToken.decimals);

          if (minAmountOut) {
            const minOut = BigInt(minAmountOut.toString());
            const minOutMinusFee = (minOut * (PARTNER_FEE_BPS_DIVISOR - this.partnerFee)) / PARTNER_FEE_BPS_DIVISOR;

            amounts.minAmountOutRaw = minOutMinusFee.toString();
            amounts.minAmountOut = formatUnits(minOutMinusFee, buyToken.decimals);
          }
        }
      }

      return {
        trade,
        computed: amounts,
      }
    } catch (error) {
      console.error('Error calculating expected output:', error);
      throw error;
    }
  }

  async checkApproval(
    tokenAddress: string,
    amount: string,
    spenderAddress: string
  ): Promise<boolean> {
    try {
      const tokenContract = new Contract(
        tokenAddress,
        ['function allowance(address,address) view returns (uint256)'],
        this.provider
      );

      const signerAddress = await this.signer?.getAddress();
      if (!signerAddress) {
        throw new Error('Please connect wallet first');
      }

      const allowance = await tokenContract.allowance(signerAddress, spenderAddress);
      const amountWei = parseUnits(amount, 18); // Assuming 18 decimals for approval check
      return allowance >= amountWei;
    } catch (error) {
      console.error('Error checking approval:', error);
      return false;
    }
  }

  async isApprovalNeeded(
    fromToken: Erc20Token,
    amountInWei: bigint,
  ): Promise<{
    isApprovalNeeded: boolean,
    tokenContract?: Contract,
    signerAddress?: string,
    allowanceTo?: string
  }> {
    if (!this.signer) {
      throw new Error('Please connect wallet first');
    }

    // If fromToken is not native, check allowance and approve if needed
    if (fromToken.address !== ethers.ZeroAddress) {
      const tokenContract = new Contract(
        fromToken.address,
        ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
        this.signer
      );

      const signerAddress = await this.signer.getAddress();

      const allowanceTo = this.config.proxyAddress || this.config.routerAddress;
      const allowance: bigint = await tokenContract.allowance(signerAddress, allowanceTo);
      if (allowance < amountInWei) {
        return {
          isApprovalNeeded: true,
          tokenContract,
          signerAddress,
          allowanceTo,
        };
      }
    }

    return {
      isApprovalNeeded: false
    };

  }

  async approveIfNeedApproval(
    fromToken: Erc20Token,
    amountInWei: bigint,
  ): Promise<ContractTransactionResponse | null> {

    const isApprovalNeededInfo = await this.isApprovalNeeded(fromToken, amountInWei);

    if (!isApprovalNeededInfo.isApprovalNeeded) {
      return null;
    }


    return await isApprovalNeededInfo.tokenContract!.approve(isApprovalNeededInfo.allowanceTo, ethers.MaxUint256);
  }

  async swapTokens(
    fromToken: Erc20Token,
    toToken: Erc20Token,
    amountInWei: string,
    amountOutWei: string,
    path: string[],
    isOutputAmount: boolean,
    deadline: number,
  ): Promise<TransactionResponse> {
    if (!this.signer) {
      throw new Error('Please connect wallet first');
    }

    try {
      // Round the amounts to the appropriate decimal precision to avoid parseUnits errors
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + (deadline * 60);

      let tx;
      const signerAddress = await this.signer.getAddress();
      const iface = this.proxyContract ? this.proxyContract.interface : this.routerContract.interface;

      let swapData: string;


      const to = this.config.proxyAddress ? this.config.proxyAddress : signerAddress;

      if (isOutputAmount) {
        // Buy mode: user specifies output amount (isOutputAmount === true)
        if (fromToken.address === ethers.ZeroAddress) {
          // ETH -> token (swapETHForExactTokens)
          swapData = iface.encodeFunctionData(this.routerContractFunctionNames.swapETHForExactTokens, [
            amountOutWei,
            path,
            to,
            deadlineTimestamp
          ]);
        } else if (toToken.address === ethers.ZeroAddress) {
          // token -> ETH (swapTokensForExactETH)
          swapData = iface.encodeFunctionData(this.routerContractFunctionNames.swapTokensForExactETH, [
            amountOutWei,
            amountInWei,
            path,
            to,
            deadlineTimestamp
          ]);
        } else {
          // token -> token (swapTokensForExactTokens)
          swapData = iface.encodeFunctionData(this.routerContractFunctionNames.swapTokensForExactTokens, [
            amountOutWei,
            amountInWei,
            path,
            to,
            deadlineTimestamp
          ]);
        }
      } else {
        if (fromToken.address === ethers.ZeroAddress) {
          // ETH -> token
          swapData = iface.encodeFunctionData(this.routerContractFunctionNames.swapExactETHForTokens, [
            amountOutWei,
            path,
            to,
            deadlineTimestamp
          ]);
        } else if (toToken.address === ethers.ZeroAddress) {
          // token -> ETH
          swapData = iface.encodeFunctionData(this.routerContractFunctionNames.swapExactTokensForETH, [
            amountInWei,
            amountOutWei,
            path,
            to,
            deadlineTimestamp
          ]);
        } else {
          // token -> token
          swapData = iface.encodeFunctionData(this.routerContractFunctionNames.swapExactTokensForTokens, [
            amountInWei,
            amountOutWei,
            path,
            to,
            deadlineTimestamp
          ]);
        }
      }

      if (this.proxyContract) {
        swapData = hexlify(this.concatSelectorAndParams(ethers.getBytes(swapData), [], "PERMIT", this.swapOptions.partnerKey));
      }

      tx = await this.signer.sendTransaction({
        to: this.config.proxyAddress || this.config.routerAddress,
        from: signerAddress,
        data: swapData,
        value: fromToken.address === ethers.ZeroAddress ? amountInWei : 0n
      });


      return tx;
    } catch (error) {
      console.error('Error swapping tokens:', error);
      throw error;
    }
  }

  async getPairAddress(tokenA: string, tokenB: string): Promise<string> {
    try {
      return await this.factoryContract.getPair(tokenA, tokenB);
    } catch (error) {
      console.error('Error getting pair address:', error);
      throw error;
    }
  }

  async checkLiquidityExists(tokenA: string, tokenB: string): Promise<boolean> {
    try {
      const pairAddress = await this.getPairAddress(tokenA, tokenB);
      return pairAddress !== ZeroAddress;
    } catch (error) {
      console.error('Error checking liquidity:', error);
      return false;
    }
  }

  // Uniswap SDK methods for advanced trading
  async createTrade(
    fromToken: Erc20Token,
    toToken: Erc20Token,
    amountIn: string,
    slippageTolerance: number = 0.5
  ): Promise<Trade<Token, Token, TradeType>> {
    try {
      // Create Token instances for Uniswap SDK
      const fromTokenInstance = new Token(
        this.chainId,
        fromToken.address,
        fromToken.decimals,
        fromToken.symbol,
        fromToken.name
      );

      const toTokenInstance = new Token(
        this.chainId,
        toToken.address,
        toToken.decimals,
        toToken.symbol,
        toToken.name
      );

      // Create currency amount
      const currencyAmount = CurrencyAmount.fromRawAmount(
        fromTokenInstance,
        parseUnits(amountIn, fromToken.decimals).toString()
      );

      // Get pair data
      const pairAddress = await this.getPairAddress(fromToken.address, toToken.address);
      if (pairAddress === ZeroAddress) {
        throw new Error('No liquidity pair found');
      }

      // Create pair instance
      const pair = new CustomFeePair(
        CurrencyAmount.fromRawAmount(fromTokenInstance, '0'),
        CurrencyAmount.fromRawAmount(toTokenInstance, '0')
      );

      // Create route
      const route = new Route([pair], fromTokenInstance, toTokenInstance);

      // Create trade
      const trade = new Trade(
        route,
        currencyAmount,
        TradeType.EXACT_INPUT
      );

      return trade;
    } catch (error) {
      console.error('Error creating trade:', error);
      throw error;
    }
  }

  /**
   * Fetch tokens from the graph endpoint (subgraph)
   * @param graphEndpoint The GraphQL endpoint URL
   * @param search Optional search string for symbol or name
   */
  async getTokensFromGraph(limit?: number, search?: string): Promise<Erc20Token[]> {
    await this.waitForPairsLoaded();
    const allTokens = Object.values(this.tokensByAddress);


    let result = allTokens;

    if (search) {
      const searchLowerCase = search.toLowerCase();
      result = result.filter(token => token.symbol.toLowerCase().includes(searchLowerCase) ||
        token.name.toLowerCase().includes(searchLowerCase));
    }

    if (limit) {
      result = result.slice(0, limit);
    }

    return result.map(token => ({
      address: token.id,
      name: token.name,
      symbol: token.symbol,
      decimals: Number.parseInt(token.decimals, 10)
    }));
  }



  /**
   * Concatenates bytes: selector, array of bytes (each element is Uint8Array), array length (uint8, 1 byte), marker (bytes16(keccak256(markerString)))
   * @param selectorBytes Uint8Array — function selector (usually 4 bytes)
   * @param arrayOfBytes Uint8Array[] — array of bytes (each element is Uint8Array)
   * @param markerString string — string from which bytes16(keccak256(...)) will be derived
   * @returns Uint8Array — concatenated result
   */
  private concatSelectorAndParams(
    selectorBytes: Uint8Array,
    arrayOfBytes: Uint8Array[],
    markerString: string,
    partnerKey?: string
  ): Uint8Array {
    // Flatten permits/params into single bytes
    const paramsBytes =
      arrayOfBytes.length === 0
        ? new Uint8Array(0)
        : arrayOfBytes.reduce((acc, arr) => {
          const res = new Uint8Array(acc.length + arr.length);
          res.set(acc, 0);
          res.set(arr, acc.length);
          return res;
        });

    const arrayLengthByte = new Uint8Array([arrayOfBytes.length & 0xff]);

    const markerHash = ethers.keccak256(ethers.toUtf8Bytes(markerString));
    const markerBytes = ethers.getBytes(markerHash).slice(0, 16);

    const parts: Uint8Array[] = [
      selectorBytes,
      paramsBytes,
      arrayLengthByte,
      markerBytes,
    ];

    if (partnerKey) {
      const partnerKeyBytes = ethers.getBytes(partnerKey); // 32 bytes
      const partnerFlagHash = ethers.keccak256(ethers.toUtf8Bytes("PARTNER"));
      const partnerFlagBytes = ethers.getBytes(partnerFlagHash).slice(0, 16); // 16 bytes
      parts.push(partnerKeyBytes, partnerFlagBytes);
    }

    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }
} 