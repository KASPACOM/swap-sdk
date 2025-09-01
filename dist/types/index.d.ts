import { SwapWidgetNetworkConfig } from "./networks";
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
    containerId: string;
    config: SwapWidgetNetworkConfig | string;
    theme?: 'light' | 'dark';
    walletProvider?: any;
    onSwapSuccess?: (txHash: string) => void;
    onSwapError?: (error: string) => void;
    onConnectWallet?: (walletAddress: string) => void;
    onDisconnectWallet?: () => void;
    initialTokens?: Erc20Token[];
    onGetTokenBalance?: (tokenAddress: string) => Promise<string>;
    onErrorEvent?: (error: string) => void;
    partnerKey?: string;
}
export type SwapActionType = 'buy' | 'sell';
export interface Trade {
    route: {
        path: Erc20Token[];
    };
    outputAmount: {
        toSignificant: (decimals: number) => string;
    };
    priceImpact: {
        toSignificant: (decimals: number) => string;
    };
}
//# sourceMappingURL=index.d.ts.map