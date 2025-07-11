import { Contract, BrowserProvider, JsonRpcProvider, formatUnits } from 'ethers';
export class WalletService {
    constructor(config, onConnectWallet, onDisconnectWallet, walletProvider) {
        this.walletProvider = null; // ethers.js BrowserProvider for wallet
        this.signer = null;
        this.address = null;
        this.ethereumWalletProvider = null; // injected provider (window.ethereum or similar)
        this.customWalletProvider = null;
        this.config = config;
        this.networkProvider = new JsonRpcProvider(config.rpcUrl, {
            name: config.name,
            chainId: config.chainId,
        }, config.additionalJsonRpcApiProviderOptionsOptions);
        this.onConnectWalletCallback = onConnectWallet;
        this.onDisconnectWalletCallback = onDisconnectWallet;
        this.customWalletProvider = walletProvider;
        // Auto-connect if wallet provider is provided
        if (this.customWalletProvider) {
            this.connect();
        }
    }
    setupEthereumListeners() {
        if (typeof window !== 'undefined' && window.ethereum) {
            this.ethereumWalletProvider = window.ethereum;
            if (!this.ethereumWalletProvider) {
                return;
            }
            // Listen for account changes
            this.ethereumWalletProvider.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected their wallet
                    this.disconnect();
                }
                else {
                    // User switched accounts
                    this.address = accounts[0];
                    this.updateWalletProvider();
                }
            });
            // Listen for chain changes
            this.ethereumWalletProvider.on('chainChanged', (chainId) => {
                const newChainId = parseInt(chainId, 16);
                if (newChainId !== this.config.chainId) {
                    // Chain changed to different network
                    this.disconnect();
                }
                else {
                    // Chain changed to our network, update provider
                    this.updateWalletProvider();
                }
            });
            // Listen for disconnect
            this.ethereumWalletProvider.on('disconnect', () => {
                this.disconnect();
            });
        }
    }
    async updateWalletProvider() {
        if (this.ethereumWalletProvider) {
            try {
                this.walletProvider = new BrowserProvider(this.ethereumWalletProvider);
                this.signer = await this.walletProvider.getSigner();
            }
            catch (error) {
                console.error('Failed to update wallet provider:', error);
            }
        }
    }
    async connect() {
        // Use custom wallet provider if available, otherwise fall back to window.ethereum
        const provider = this.customWalletProvider || (typeof window !== 'undefined' && window.ethereum);
        if (!provider) {
            this.setupEthereumListeners();
        }
        const effectiveProvider = this.customWalletProvider || (typeof window !== 'undefined' && window.ethereum);
        if (!effectiveProvider) {
            throw new Error('No Ethereum wallet detected. Please install MetaMask or another Ethereum wallet.');
        }
        this.ethereumWalletProvider = effectiveProvider;
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
                }
                catch (switchError) {
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
                    }
                    else {
                        throw new Error(`Please switch to ${this.config.name} network`);
                    }
                }
            }
            // Update walletProvider and signer
            await this.updateWalletProvider();
            // Emit the wallet address if callback is provided
            if (this.onConnectWalletCallback) {
                this.onConnectWalletCallback(this.address);
            }
            return this.address;
        }
        catch (error) {
            if (error.code === 4001) {
                throw new Error('User rejected wallet connection');
            }
            throw new Error(`Failed to connect wallet: ${error.message}`);
        }
    }
    // Method to manually connect to a specific wallet provider
    async connectToProvider(provider) {
        this.customWalletProvider = provider;
        this.ethereumWalletProvider = provider;
        return this.connect();
    }
    disconnect() {
        this.address = null;
        this.signer = null;
        this.walletProvider = null;
        // networkProvider remains for read-only operations
        if (this.onDisconnectWalletCallback) {
            this.onDisconnectWalletCallback();
        }
    }
    isConnected() {
        return !!this.address && !!this.signer;
    }
    getAddress() {
        return this.address;
    }
    getProvider() {
        return this.walletProvider || this.networkProvider;
    }
    getSigner() {
        return this.signer;
    }
    async getBalance() {
        if (!this.walletProvider || !this.address) {
            throw new Error('Wallet not connected');
        }
        const balance = await this.walletProvider.getBalance(this.address);
        return formatUnits(balance, 18);
    }
    async getTokenBalance(tokenAddress) {
        if (!this.walletProvider || !this.address) {
            throw new Error('Wallet not connected');
        }
        const tokenContract = new Contract(tokenAddress, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], this.walletProvider);
        const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(this.address),
            tokenContract.decimals()
        ]);
        return formatUnits(balance, decimals);
    }
    async getTokenAllowance(tokenAddress, spenderAddress) {
        if (!this.walletProvider || !this.address) {
            throw new Error('Wallet not connected');
        }
        const tokenContract = new Contract(tokenAddress, ['function allowance(address,address) view returns (uint256)', 'function decimals() view returns (uint8)'], this.walletProvider);
        const [allowance, decimals] = await Promise.all([
            tokenContract.allowance(this.address, spenderAddress),
            tokenContract.decimals()
        ]);
        return formatUnits(allowance, decimals);
    }
    // Helper method to check if wallet is available
    isWalletAvailable() {
        return typeof window !== 'undefined' && !!window.ethereum;
    }
    // Helper method to get current chain ID
    async getCurrentChainId() {
        if (!this.ethereumWalletProvider) {
            throw new Error('No Ethereum wallet detected');
        }
        const chainId = await this.ethereumWalletProvider.request({
            method: 'eth_chainId'
        });
        return parseInt(chainId, 16);
    }
    // Register a callback for wallet connected
    onConnectWallet(cb) {
        this.onConnectWalletCallback = cb;
    }
    // Register a callback for wallet disconnected
    onDisconnectWallet(cb) {
        this.onDisconnectWalletCallback = cb;
    }
    // Call the connect callback
    emitConnectWallet(address) {
        if (this.onConnectWalletCallback) {
            this.onConnectWalletCallback(address);
        }
    }
    // Call the disconnect callback
    emitDisconnectWallet() {
        if (this.onDisconnectWalletCallback) {
            this.onDisconnectWalletCallback();
        }
    }
    // Connect wallet and emit event with address
    async connectWallet() {
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                if (accounts.length > 0 && typeof accounts[0] === 'string') {
                    const address = accounts[0];
                    this.address = address;
                    this.emitConnectWallet(address);
                    return address;
                }
                else {
                    throw new Error('No accounts found');
                }
            }
            catch (error) {
                console.error('Failed to connect wallet:', error);
                throw error;
            }
        }
        else {
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
//# sourceMappingURL=wallet.service.js.map