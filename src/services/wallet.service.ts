import { BrowserProvider, JsonRpcProvider, Signer, Eip1193Provider } from 'ethers';
import { SwapSdkNetworkConfig } from '../types/networks';

export class WalletService {
  private networkProvider: JsonRpcProvider;
  private signer: Signer | null = null;
  private address: string | null = null;
  private config: SwapSdkNetworkConfig;
  private injectedProvider?: Eip1193Provider;
  private walletProvider?: BrowserProvider; // injected provider (window.ethereum or similar)

  constructor(
    config: SwapSdkNetworkConfig,
    injectedProvider?: Eip1193Provider,
  ) {
    this.config = config;
    this.networkProvider = new JsonRpcProvider(config.rpcUrl, {
      name: config.name,
      chainId: config.chainId,
    }, config.additionalJsonRpcApiProviderOptionsOptions);
    if (injectedProvider) {
      this.connect(this.injectedProvider);

    }
  }

  async connect(injectedProvider?: Eip1193Provider): Promise<string> {
    if (injectedProvider) {
      this.injectedProvider = injectedProvider;
      this.walletProvider = new BrowserProvider(this.injectedProvider);
    }

    if (!this.injectedProvider || !this.walletProvider) {
      throw new Error('Please connect wallet.');
    }

    try {
      // Request account access
      const accounts = await this.injectedProvider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      this.address = accounts[0];

      // Check if we're on the correct network
      const chainId = await this.injectedProvider.request({
        method: 'eth_chainId'
      });
      const currentChainId = parseInt(chainId, 16);
      if (currentChainId !== this.config.chainId) {
        // Try to switch to the correct network
        try {
          await this.injectedProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${this.config.chainId.toString(16)}` }]
          });
        } catch (switchError: any) {
          // If the network doesn't exist, try to add it
          if (switchError.code === 4902) {
            await this.injectedProvider.request({
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

            await this.injectedProvider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${this.config.chainId.toString(16)}` }]
            });
          } else {
            throw new Error(`Please switch to ${this.config.name} network`);
          }
        }
      }
      // Update injectedProvider and signer
      this.signer = await this.walletProvider.getSigner();

      return this.address!;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected wallet connection');
      }
      throw new Error(`Failed to connect wallet: ${error.message}`);
    }
  }

  disconnect(): void {
    this.address = null;
    this.signer = null;
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

  // Helper method to get current chain ID
  async getCurrentChainId(): Promise<number> {
    if (!this.injectedProvider) {
      throw new Error('No Ethereum wallet detected');
    }
    const chainId = await this.injectedProvider.request({
      method: 'eth_chainId'
    });
    return parseInt(chainId, 16);
  }

  // Connect wallet and emit event with address
  async connectWallet(): Promise<string> {
    if (this.injectedProvider) {
      try {
        const accounts = await this.injectedProvider.request({
          method: 'eth_requestAccounts'
        });
        if (accounts.length > 0 && typeof accounts[0] === 'string') {
          const address: string = accounts[0];
          this.address = address;
          return address;
        } else {
          throw new Error('No accounts found');
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
      }
    } else {
      throw new Error('No Ethereum wallet detected. Please connect a wallet provider.');
    }
  }

  // Disconnect wallet and emit event
  disconnectWallet() {
    this.address = null;
    this.signer = null;
  }
} 