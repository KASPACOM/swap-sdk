import { Trade } from "@uniswap/v2-sdk";
import { Currency, Token, TradeType } from "@uniswap/sdk-core";
import { Eip1193Provider } from "ethers";

export interface Erc20Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance?: number;
  rawBalance?: string;
  logoURI?: string;
}

export interface SwapSettings {
  maxSlippage: string;
  swapDeadline: number;
}

export interface SwapState {
  needsApproval: boolean;
  isApproved: boolean;
  isApproving: boolean;
  isSwapping: boolean;
  error: string | null;
  success: boolean;
  transactionHash: string | null;
  status: string | null;
  expectedAmountOut: string | null;
  isCalculating: boolean;
}

export interface SwapSectionData {
  title: string;
  amount: string;
  usdValue: string;
}

export interface SwapSdkOptions {
  networkConfig: SwapSdkNetworkConfig | string;
  walletProvider?: Eip1193Provider; // Custom wallet provider (e.g., MetaMask, WalletConnect, etc.)
  partnerKey?: string;
  onChange?: (state: SwapControllerOutput, patch: Partial<SwapControllerOutput>) => Promise<void>;
  refreshPairsInterval?: number;
  updateQuoteAfterRefreshPairs?: boolean;
  getPairsData?: () => Promise<KaspaComSdkPair[]>;
  swapServiceClass?: any;
  maxHops?: number;
}



export interface SwapControllerInput {
  fromToken?: Erc20Token | null;
  toToken?: Erc20Token | null;
  amount?: number;
  isOutputAmount?: boolean;
  settings?: Partial<SwapSettings>;
}

export enum LoaderStatuses {
  CALCULATING_QUOTE = 1,
  APPROVING = 2,
  SWAPPING = 3,
}

export interface ComputedAmounts {
  maxAmountIn?: string,
  minAmountOut?: string,
  amountIn: string,
  amountOut: string,
  amountInRaw: string,
  amountOutRaw: string,
  maxAmountInRaw?: string,
  minAmountOutRaw?: string,
}

export interface SwapControllerOutput {
  error?: string;
  txHash?: string;
  approveTxHash?: string;
  /**
   * @deprecated Use `computed` instead, The tradeInfo can contain incorrect information
   */
  tradeInfo?: Trade<Currency, Currency, TradeType.EXACT_INPUT> | Trade<Currency, Currency, TradeType.EXACT_OUTPUT>;
  path?: Token[],
  computed?: ComputedAmounts;
  loader: LoaderStatuses | null;
}

export interface SwapSdkNetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  routerAddress: string;
  factoryAddress: string;
  proxyAddress?: string;
  badckendApiUrl: string;
  blockExplorerUrl?: string;
  additionalJsonRpcApiProviderOptionsOptions?: any;
  nativeToken: Erc20Token;
  wrappedToken: Erc20Token;
  isTestnet?: boolean;
  defiApiNetworkName: string;
}


export interface KaspaComSdkToken {
  id: string;
  symbol: string;
  name: string;
  totalSupply: string;
  decimals: string;
  derivedKAS: string;
};

export interface KaspaComSdkPair {
  id: string;
  token0: KaspaComSdkToken;
  token1: KaspaComSdkToken
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  reserveKAS: string;
  token0Price: string;
  token1Price: string;
  volumeKAS: string;
  txCount: string;
  createdAtTimestamp: string;
}