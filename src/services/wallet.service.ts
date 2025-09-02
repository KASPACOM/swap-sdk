import { Contract, BrowserProvider, JsonRpcProvider, Signer, parseUnits, formatUnits } from 'ethers';
import { SwapWidgetNetworkConfig } from '../types/networks';

export class WalletService {
  private networkProvider: JsonRpcProvider;
  private walletProvider: BrowserProvider | null = null; // ethers.js BrowserProvider for wallet
  private signer: Signer | null = null;
  private address: string | null = null;
  private onConnectWalletCallback?: (walletAddress: string) => void;
  private onDisconnectWalletCallback?: () => void;
  private config: SwapWidgetNetworkConfig;
  private ethereumWalletProvider: any = null; // injected provider (window.ethereum or similar)
  private customWalletProvider: any = null;

  constructor(
    config: SwapWidgetNetworkConfig,
    walletProvider?: any
  ) {
    this.config = config;
    this.networkProvider = new JsonRpcProvider(config.rpcUrl, {
      name: config.name,
      chainId: config.chainId,
    }, config.additionalJsonRpcApiProviderOptionsOptions);
    this.customWalletProvider = walletProvider;
    
    // Auto-connect if wallet provider is provided
    if (this.customWalletProvider) {
      this.connect();
    }
  }

  private async updateWalletProvider(): Promise<void> {
    if (this.ethereumWalletProvider) {
      try {
        this.walletProvider = new BrowserProvider(this.ethereumWalletProvider);
        this.signer = await this.walletProvider.getSigner();
      } catch (error) {
        console.error('Failed to update wallet provider:', error);
      }
    }
  }

  async connect(): Promise<string> {
    const etheriumProvider = this.customWalletProvider;

    if (!etheriumProvider) {
      throw new Error('No Ethereum wallet detected. Please install MetaMask or another Ethereum wallet.');
    }
    this.ethereumWalletProvider = etheriumProvider;
    try {
      // Request account access
      const accounts = await this.ethereumWalletProvider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      this.address = accounts[0];

      // Check if we're on the correct network
      const chainId = await this.ethereumWalletProvider.request({
        method: 'eth_chainId'
      });
      const currentChainId = parseInt(chainId, 16);
      if (currentChainId !== this.config.chainId) {
        // Try to switch to the correct network
        try {
          await this.ethereumWalletProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${this.config.chainId.toString(16)}` }]
          });
        } catch (switchError: any) {
          // If the network doesn't exist, try to add it
          if (switchError.code === 4902) {
            await this.ethereumWalletProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${this.config.chainId.toString(16)}`,
                chainName: this.config.name,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: [this.config.rpcUrl],
                blockExplorerUrls: this.config.blockExplorerUrl ? [this.config.blockExplorerUrl] : []
              }]
            });
          } else {
            throw new Error(`Please switch to ${this.config.name} network`);
          }
        }
      }
      // Update walletProvider and signer
      await this.updateWalletProvider();
      // Emit the wallet address if callback is provided
      if (this.onConnectWalletCallback) {
        this.onConnectWalletCallback(this.address!);
      }
      return this.address!;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected wallet connection');
      }
      throw new Error(`Failed to connect wallet: ${error.message}`);
    }
  }

  // Method to manually connect to a specific wallet provider
  async connectToProvider(provider: any): Promise<string> {
    this.customWalletProvider = provider;
    this.ethereumWalletProvider = provider;
    return this.connect();
  }

  disconnect(): void {
    this.address = null;
    this.signer = null;
    this.walletProvider = null;
    // networkProvider remains for read-only operations
    if (this.onDisconnectWalletCallback) {
      this.onDisconnectWalletCallback();
    }
  }

  isConnected(): boolean {
    return !!this.address && !!this.signer;
  }

  getAddress(): string | null {
    return this.address;
  }

  getProvider(): BrowserProvider | JsonRpcProvider | null {
    return this.walletProvider || this.networkProvider;
  }

  getSigner(): Signer | null {
    return this.signer;
  }

  async getBalance(): Promise<string> {
    if (!this.walletProvider || !this.address) {
      throw new Error('Wallet not connected');
    }
    const balance = await this.walletProvider.getBalance(this.address);
    return formatUnits(balance, 18);
  }

  async getTokenBalance(tokenAddress: string): Promise<string> {
    if (!this.walletProvider || !this.address) {
      throw new Error('Wallet not connected');
    }
    const tokenContract = new Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
      this.walletProvider
    );
    const [balance, decimals] = await Promise.all([
      tokenContract.balanceOf(this.address),
      tokenContract.decimals()
    ]);
    return formatUnits(balance, decimals);
  }

  async getTokenAllowance(tokenAddress: string, spenderAddress: string): Promise<string> {
    if (!this.walletProvider || !this.address) {
      throw new Error('Wallet not connected');
    }
    const tokenContract = new Contract(
      tokenAddress,
      ['function allowance(address,address) view returns (uint256)', 'function decimals() view returns (uint8)'],
      this.walletProvider
    );
    const [allowance, decimals] = await Promise.all([
      tokenContract.allowance(this.address, spenderAddress),
      tokenContract.decimals()
    ]);
    return formatUnits(allowance, decimals);
  }

  // Helper method to check if wallet is available
  isWalletAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  // Helper method to get current chain ID
  async getCurrentChainId(): Promise<number> {
    if (!this.ethereumWalletProvider) {
      throw new Error('No Ethereum wallet detected');
    }
    const chainId = await this.ethereumWalletProvider.request({
      method: 'eth_chainId'
    });
    return parseInt(chainId, 16);
  }

  // Register a callback for wallet connected
  onConnectWallet(cb: (walletAddress: string) => void) {
    this.onConnectWalletCallback = cb;
  }

  // Register a callback for wallet disconnected
  onDisconnectWallet(cb: () => void) {
    this.onDisconnectWalletCallback = cb;
  }

  // Call the connect callback
  private emitConnectWallet(address: string) {
    if (this.onConnectWalletCallback) {
      this.onConnectWalletCallback(address);
    }
  }

  // Call the disconnect callback
  private emitDisconnectWallet() {
    if (this.onDisconnectWalletCallback) {
      this.onDisconnectWalletCallback();
    }
  }

  // Connect wallet and emit event with address
  async connectWallet(): Promise<string> {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        if (accounts.length > 0 && typeof accounts[0] === 'string') {
          const address: string = accounts[0];
          this.address = address;
          this.emitConnectWallet(address);
          return address;
        } else {
          throw new Error('No accounts found');
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
      }
    } else {
      throw new Error('No Ethereum wallet detected. Please install MetaMask or another Ethereum wallet.');
    }
  }

  // Disconnect wallet and emit event
  disconnectWallet() {
    this.address = null;
    this.signer = null;
    this.walletProvider = null;
    this.emitDisconnectWallet();
  }
} 