import { BrowserProvider, JsonRpcProvider, Signer } from 'ethers';
import { SwapWidgetNetworkConfig } from '../types/networks';
declare global {
    interface Window {
        ethereum?: any;
    }
}
export declare class WalletService {
    private networkProvider;
    private walletProvider;
    private signer;
    private address;
    private onConnectWalletCallback?;
    private onDisconnectWalletCallback?;
    private config;
    private ethereumWalletProvider;
    private customWalletProvider;
    constructor(config: SwapWidgetNetworkConfig, onConnectWallet?: (walletAddress: string) => void, onDisconnectWallet?: () => void, walletProvider?: any);
    private setupEthereumListeners;
    private updateWalletProvider;
    connect(): Promise<string>;
    connectToProvider(provider: any): Promise<string>;
    disconnect(): void;
    isConnected(): boolean;
    getAddress(): string | null;
    getProvider(): BrowserProvider | JsonRpcProvider | null;
    getSigner(): Signer | null;
    getBalance(): Promise<string>;
    getTokenBalance(tokenAddress: string): Promise<string>;
    getTokenAllowance(tokenAddress: string, spenderAddress: string): Promise<string>;
    isWalletAvailable(): boolean;
    getCurrentChainId(): Promise<number>;
    onConnectWallet(cb: (walletAddress: string) => void): void;
    onDisconnectWallet(cb: () => void): void;
    private emitConnectWallet;
    private emitDisconnectWallet;
    connectWallet(): Promise<string>;
    disconnectWallet(): void;
}
//# sourceMappingURL=wallet.service.d.ts.map