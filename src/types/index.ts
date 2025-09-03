import { Trade } from "@uniswap/v2-sdk";
import { SwapWidgetNetworkConfig } from "./networks";
import { Currency, TradeType } from "@uniswap/sdk-core";

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

export interface SwapWidgetOptions {
  networkConfig: SwapWidgetNetworkConfig | string;
  walletProvider: any; // Custom wallet provider (e.g., MetaMask, WalletConnect, etc.)
  partnerKey?: string;
  onChange?: (state: SwapControllerOutput, patch: Partial<SwapControllerOutput>) => Promise<void>;
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
  tradeInfo?: Trade<Currency, Currency, TradeType.EXACT_INPUT> | Trade<Currency, Currency, TradeType.EXACT_OUTPUT>;
  computed?: ComputedAmounts;
  loader: LoaderStatuses | null;
} 