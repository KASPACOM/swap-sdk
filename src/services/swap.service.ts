import { BigNumberish, Contract, Signer, BrowserProvider, JsonRpcProvider, parseUnits, formatUnits, ZeroAddress, ethers, hexlify } from 'ethers';
import { CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';
import { Trade, Pair, Route } from '@uniswap/v2-sdk';
import { Erc20Token, SwapSettings, SwapWidgetOptions } from '../types';
import { SwapWidgetNetworkConfig } from '../types/networks';

export class SwapService {
  private provider: BrowserProvider | JsonRpcProvider;
  private signer: Signer | null = null;
  private routerContract: Contract;
  private factoryContract: Contract;
  private proxyContract?: Contract;
  private wethAddress: string;
  private chainId: number;
  private pairs: Pair[] = [];
  private pairsLoadedPromise: Promise<void>;
  private resolvePairsLoaded: (() => void) | null = null;
  private partnerFeeLoadedPromise: Promise<void>;
  private resolvePartnerFeeLoaded: (() => void) | null = null;
  private partnerFee: number = 0;
  private isFeeActive: boolean = false;

  private wethToken: Erc20Token | undefined;




  constructor(
    provider: BrowserProvider | JsonRpcProvider,
    private config: SwapWidgetNetworkConfig,
    private swapOptions: SwapWidgetOptions,
  ) {
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
      'function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn)',
      'function getAmountsIn(address factory, uint amountOut, address[] memory path) internal view returns (uint[] memory amounts)',
      'function WETH() external pure returns (address)'
    ];

    // Factory ABI for pair operations
    const factoryAbi = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)'
    ];

    const proxyAbi = [
      ...routerAbi,
      'function partnerFee(bytes32) external view returns (address feeRecipient, uint16 feeBps)',
      'function feeEnabled() external view returns (bool)',
    ]

    this.routerContract = new Contract(config.routerAddress, routerAbi, provider);
    this.factoryContract = new Contract(config.factoryAddress, factoryAbi, provider);

    if (config.proxyAddress) {
      this.proxyContract = new Contract(config.proxyAddress, proxyAbi, provider);
    }

    this.pairsLoadedPromise = new Promise((resolve) => {
      this.resolvePairsLoaded = resolve;
    });

    this.partnerFeeLoadedPromise = new Promise((resolve) => {
      this.resolvePartnerFeeLoaded = resolve;
    });
    this.loadAllPairsFromGraph(config.graphEndpoint);
    this.loadPartnerFee();
  }

  private async loadPartnerFee(): Promise<void> {
    if (this.swapOptions.partnerKey) {
      const [, fee] = await this.proxyContract?.partnerFee(this.swapOptions.partnerKey);
      this.partnerFee = Number(fee) / 10000;
      this.partnerFee = 1; // Currently taking all, when new proxy will arrive we will need to delete this
    }

    const isFeeActive = await this.proxyContract?.feeEnabled();
    this.isFeeActive = isFeeActive;

    if (this.resolvePartnerFeeLoaded) {
      this.resolvePartnerFeeLoaded();
      this.resolvePartnerFeeLoaded = null;
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

  /**
   * Loads all pairs from The Graph and caches them as Uniswap SDK Pair instances.
   * @param graphEndpoint The GraphQL endpoint URL
   */
  public async loadAllPairsFromGraph(graphEndpoint: string): Promise<void> {
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
      if (!response.ok) throw new Error(`Network error: ${response.status}`);
      const { data } = await response.json();
      if (!data || !data.pairs) return;
      const pairs: Pair[] = [];
      for (const pair of data.pairs) {
        pairs.push(
          this.createSDKPair(pair)
        );
      }
      this.pairs = pairs;

      // Find the WETH token from the pairs and set wethToken to a new Token instance if found
      const wethPair = data.pairs.find(
        (pair: any) =>
          pair.token0.id.toLowerCase() === this.wethAddress.toLowerCase() ||
          pair.token1.id.toLowerCase() === this.wethAddress.toLowerCase()
      );
      if (wethPair) {
        const tokenData =
          wethPair.token0.id.toLowerCase() === this.wethAddress.toLowerCase()
            ? wethPair.token0
            : wethPair.token1;
        this.wethToken = {
          address: tokenData.id,
          symbol: tokenData.symbol,
          name: tokenData.name,
          decimals: Number(tokenData.decimals),
        }
      } else {
        throw new Error('No weth token found')
      }

      if (this.resolvePairsLoaded) {
        this.resolvePairsLoaded();
        this.resolvePairsLoaded = null;
      }
    } catch (error) {
      console.error('Error loading pairs from graph:', error);
      if (this.resolvePairsLoaded) {
        this.resolvePairsLoaded(); // resolve anyway to avoid deadlock
        this.resolvePairsLoaded = null;
      }
    }
  }

  public async waitForPairsLoaded(): Promise<void> {
    return await this.pairsLoadedPromise;
  }

  public async waitForPartnerFeeLoaded(): Promise<void> {
    return await this.partnerFeeLoadedPromise;
  }

  createSDKPair(pair: {
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: string | number;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: string | number;
    };
    reserve0?: string;
    reserve1?: string;
    positionValueUsd?: number;
    totalTokens?: number;
  }): Pair {
    const { token0, token1, id, reserve0, reserve1 } = pair;

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

    const sdkPair = new Pair(amount0, amount1);
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
  private async getBestTradePath(
    fromToken: Erc20Token,
    toToken: Erc20Token,
    amountInWei: string,
  ): Promise<string[] | null> {
    console.log('Getting trade best path');

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
      sdkFromToken,
      amountInWei,
    );
    await this.waitForPairsLoaded();
    await this.waitForPartnerFeeLoaded();

    const pairs = this.getPairs();
    if (!pairs || pairs.length === 0) {
      throw new Error('Pairs not loaded yet. Please wait for initialization.');
    }

    const trades = Trade.bestTradeExactIn(
      pairs,
      currencyAmount,
      sdkToToken,
      {
        maxHops: 3,
        maxNumResults: 3,
      },
    );

    if (trades.length > 0) {
      const bestTrade = trades[0];
      return bestTrade.route.path.map((token) => token.address);
    } else {
      return null;
    }
  }


  async calculateExpectedOutput(
    sellToken: Erc20Token,
    buyToken: Erc20Token,
    amountIn: string,
  ): Promise<{
    amount: string,
    path: string[],
  }> {
    try {
      // Round the input amount to avoid parseUnits errors
      const roundedAmountIn = this.roundToDecimals(amountIn, sellToken.decimals);
      const sellAmountWei = parseUnits(
        roundedAmountIn,
        sellToken.decimals,
      );

      // Get the best path
      const bestPath = await this.getBestTradePath(
        sellToken.address == ethers.ZeroAddress ? this.wethToken! : sellToken,
        buyToken.address == ethers.ZeroAddress ? this.wethToken! : buyToken,
        sellAmountWei.toString(),
      );

      if (!bestPath) {
        throw new Error('No trade path found for the given tokens and amount.');
      }

      // Use routerContract to get expected output
      const amountsOut = await this.routerContract.getAmountsOut(sellAmountWei, bestPath);
      let expectedOutput = amountsOut[amountsOut.length - 1];

      if (this.partnerFee) {
        console.log('Partner fee:', this.partnerFee);
        console.log('Expected output:', expectedOutput);
        expectedOutput = BigInt(Math.floor(Number(expectedOutput) * ((100 - this.partnerFee) / 100)));
        console.log('Expected output after partner fee:', expectedOutput);
      }

      // Convert bigint to human-readable string
      let expectedOutputHumanReadable = formatUnits(
        expectedOutput.toString(),
        buyToken.decimals,
      );

      return {
        amount: expectedOutputHumanReadable,
        path: bestPath,
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
        throw new Error('Signer not available');
      }

      const allowance = await tokenContract.allowance(signerAddress, spenderAddress);
      const amountWei = parseUnits(amount, 18); // Assuming 18 decimals for approval check
      return allowance >= amountWei;
    } catch (error) {
      console.error('Error checking approval:', error);
      return false;
    }
  }

  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    try {
      const tokenContract = new Contract(
        tokenAddress,
        ['function approve(address,uint256) returns (bool)'],
        this.signer
      );

      const amountWei = parseUnits(amount, 18);
      const tx = await tokenContract.approve(spenderAddress, amountWei);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }

  async swapTokens(
    fromToken: Erc20Token,
    toToken: Erc20Token,
    amountInWei: bigint,
    amountOutMinWei: bigint,
    path: string[],
    deadline: number,
    settings: SwapSettings
  ): Promise<string> {
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
        const tokenContract = new Contract(
          fromToken.address,
          ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
          this.signer
        );

        const allowanceTo = this.config.proxyAddress || this.config.routerAddress;
        const allowance: bigint = await tokenContract.allowance(signerAddress, allowanceTo);
        if (allowance < amountInWei) {
          // Approve MaxUint256 for router
          const approveTx = await tokenContract.approve(allowanceTo, ethers.MaxUint256);
          await approveTx.wait();
        }
      }


      if (this.proxyContract) {
        console.log(amountInWei, amountOutMinWei, path, deadlineTimestamp);
        let swapData: string;
        const iface = this.proxyContract.interface;

        console.log('signer address', signerAddress);

        const to = this.isFeeActive ? this.config.proxyAddress : signerAddress;

        if (fromToken.address === ethers.ZeroAddress) {
          // ETH -> token
          swapData = iface.encodeFunctionData("swapExactETHForTokens", [
            amountOutMinWei,
            path,
            to,
            deadlineTimestamp
          ]);
        } else if (toToken.address === ethers.ZeroAddress) {
          // token -> ETH
          swapData = iface.encodeFunctionData("swapExactTokensForETH", [
            amountInWei,
            amountOutMinWei,
            path,
            to,
            deadlineTimestamp
          ]);
        } else {
          // token -> token
          swapData = iface.encodeFunctionData("swapExactTokensForTokens", [
            amountInWei,
            amountOutMinWei,
            path,
            to,
            deadlineTimestamp
          ]);
        }


        const finalCallData = this.concatSelectorAndParams(ethers.getBytes(swapData), [], "permit", this.swapOptions.partnerKey);




        tx = await this.signer.sendTransaction({
          to: this.config.proxyAddress,
          from: signerAddress,
          data: hexlify(finalCallData),
          value: fromToken.address === ethers.ZeroAddress ? amountInWei : 0n
        });


      } else {
        if (fromToken.address === ethers.ZeroAddress) {
          // Swap ETH for tokens
          tx = await this.routerContract.swapExactETHForTokens(
            amountOutMinWei,
            path,
            signerAddress,
            deadlineTimestamp,
            { value: amountInWei }
          );
        } else if (toToken.address === ethers.ZeroAddress) {
          // Swap tokens for ETH
          tx = await this.routerContract.swapExactTokensForETH(
            amountInWei,
            amountOutMinWei,
            path,
            signerAddress,
            deadlineTimestamp
          );
        } else {
          // Swap tokens for tokens
          tx = await this.routerContract.swapExactTokensForTokens(
            amountInWei,
            amountOutMinWei,
            path,
            signerAddress,
            deadlineTimestamp
          );
        }
      }



      const receipt = await tx.wait();
      return receipt.hash;
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
      const pair = new Pair(
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
  async getTokensFromGraph(graphEndpoint: string, search?: string): Promise<Erc20Token[]> {
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
      if (!response.ok) throw new Error(`Network error: ${response.status}`);
      const { data } = await response.json();
      if (!data || !data.tokens) return [];
      return data.tokens.map((token: any) => ({
        address: token.id,
        symbol: token.symbol,
        name: token.name,
        decimals: Number(token.decimals),
      }));
    } catch (error) {
      console.error('Error fetching tokens from graph:', error);
      return [];
    }
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
    const paramsBytes = arrayOfBytes.length === 0
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
      const partnerFlagHash = ethers.keccak256(ethers.toUtf8Bytes("is_partner_fee"));
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