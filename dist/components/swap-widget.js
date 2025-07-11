import { WalletService } from '../services/wallet.service';
import { SwapService } from '../services/swap.service';
import { parseUnits } from 'ethers';
export class SwapWidget {
    constructor(options) {
        // State management
        this.state = {
            needsApproval: false,
            isApproved: false,
            isApproving: false,
            isSwapping: false,
            error: null,
            success: false,
            transactionHash: null,
            status: null,
            expectedAmountOut: null,
            isCalculating: false,
        };
        // Swap data
        this.sellToken = null;
        this.buyToken = null;
        this.sellAmount = '0';
        this.buyAmount = '0';
        this.swapAction = 'sell';
        this.settings = {
            maxSlippage: '0.5',
            swapDeadline: 20,
        };
        // UI elements
        this.sellSection = null;
        this.buySection = null;
        this.swapButton = null;
        this.connectWalletButton = null;
        this.settingsButton = null;
        this.tokenModal = null;
        this.tokenModalSection = null;
        this.allTokens = [];
        // Add this property to the class
        this.tokenSearchDebounceTimer = null;
        this.sellAmountDebounceTimer = null;
        // Add a property to track currently displayed tokens
        this.displayedTokens = [];
        // Add tradePath property
        this.tradePath = [];
        // Add interval timer for periodic updates
        this.updateInterval = null;
        this.errorModal = null;
        this.disconnectWalletButton = null;
        this.options = options;
        this.container = document.getElementById(options.containerId) || document.createElement('div');
        // Initialize services
        this.walletService = new WalletService(options.config, (...args) => {
            // Set the signer in the swap service
            const signer = this.walletService.getSigner();
            if (signer) {
                this.swapService.setSigner(signer);
            }
            this.render();
            this.attachEventListeners();
            this.updateBalances();
            if (options?.onConnectWallet) {
                options.onConnectWallet(...args);
            }
        }, (...args) => {
            // Clear the signer in the swap service
            this.swapService.setSigner(null);
            this.render();
            this.attachEventListeners();
            this.updateBalances();
            if (options?.onDisconnectWallet) {
                options.onDisconnectWallet(...args);
            }
        }, options.walletProvider);
        this.swapService = new SwapService(this.walletService.getProvider(), options.config);
        this.initializeWidget();
    }
    async initializeWidget() {
        this.render();
        this.attachEventListeners();
        await this.swapService.waitForPairsLoaded();
        await this.loadInitialData();
        // Start periodic updates every 20 seconds
        this.startPeriodicUpdates();
    }
    render() {
        this.container.innerHTML = `
      <div class="swap-widget ${this.options.theme || 'light'}">
        <div class="swap-header">
          <h3>Swap Tokens</h3>
        </div>
        ${this.state.error ? `<div class="swap-widget-error">${this.state.error}</div>` : ''}
        <div class="swap-sections">
          <div class="swap-section sell-section" id="sell-section">
            <div class="section-header">
              <span class="section-title">Sell</span>
              <button class="token-select-button" id="sell-token-btn">
                ${this.sellToken ? this.sellToken.symbol : 'Select Token'}
              </button>
            </div>
            <div class="amount-input-container">
              <input type="text" class="amount-input" id="sell-amount" placeholder="0.0" value="${this.sellAmount}">
            </div>
            <div class="balance-info">
              Balance: <span id="sell-balance">0.0</span>
            </div>
          </div>
          
          <div class="swap-arrow" id="swap-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 10l5 5 5-5"/>
              <path d="M7 4l5 5 5-5"/>
            </svg>
          </div>
          
          <div class="swap-section buy-section" id="buy-section">
            <div class="section-header">
              <span class="section-title">Buy</span>
              <button class="token-select-button" id="buy-token-btn">
                ${this.buyToken ? this.buyToken.symbol : 'Select Token'}
              </button>
            </div>
            <div class="amount-input-container">
              <input type="text" class="amount-input" id="buy-amount" placeholder="0.0" value="${this.buyAmount}" readonly>
            </div>
            <div class="balance-info">
              Balance: <span id="buy-balance">0.0</span>
            </div>
          </div>
        </div>
        
        <div class="button-container">
          ${!this.walletService.isConnected() ? `
            <button class="connect-wallet-button" id="connect-wallet-btn">
              Connect Wallet
            </button>
          ` : `
            <button class="swap-button" id="swap-btn" ${this.canSwap() ? '' : 'disabled'}>
              ${this.getSwapButtonText()}
            </button>
          `}
          ${(this.walletService.isConnected() && !this.options.walletProvider) ? `
            <button class="disconnect-wallet-button" id="disconnect-wallet-btn">
              Disconnect Wallet
            </button>
          ` : ''}
        </div>
      </div>
    `;
        // Store references to elements
        this.sellSection = document.getElementById('sell-section');
        this.buySection = document.getElementById('buy-section');
        this.swapButton = document.getElementById('swap-btn');
        this.connectWalletButton = document.getElementById('connect-wallet-btn');
        // Add reference for disconnect button
        this.disconnectWalletButton = document.getElementById('disconnect-wallet-btn');
        this.updateButtons();
    }
    attachEventListeners() {
        // Sell amount input
        const sellAmountInput = document.getElementById('sell-amount');
        sellAmountInput?.addEventListener('input', (e) => {
            this.state.isCalculating = true;
            this.updateButtons();
            this.sellAmount = e.target.value;
            if (this.sellAmountDebounceTimer)
                clearTimeout(this.sellAmountDebounceTimer);
            this.sellAmountDebounceTimer = setTimeout(() => {
                this.onSellAmountChange();
            }, 300);
        });
        // Token selection buttons
        document.getElementById('sell-token-btn')?.addEventListener('click', () => {
            this.onTokenSelect('sell');
        });
        document.getElementById('buy-token-btn')?.addEventListener('click', () => {
            this.onTokenSelect('buy');
        });
        // Swap arrow
        document.getElementById('swap-arrow')?.addEventListener('click', () => {
            this.onSwitchTokens();
        });
        // Connect wallet button
        this.connectWalletButton?.addEventListener('click', () => {
            this.onConnectWalletClick();
        });
        // Swap button
        this.swapButton?.addEventListener('click', () => {
            this.onSwapClick();
        });
        // Disconnect wallet button
        const disconnectBtn = document.getElementById('disconnect-wallet-btn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnectWallet();
            });
        }
    }
    async loadInitialData() {
        // Load tokens if provided as initialTokens
        if (this.options.initialTokens && this.options.initialTokens.length > 0) {
            const tokens = this.options.initialTokens;
            this.sellToken = tokens[0];
            if (tokens.length > 1) {
                this.buyToken = tokens[1];
            }
            this.allTokens = tokens;
            this.updateTokenDisplay();
            this.updateBalances();
        }
        else {
            // Fetch tokens from the graph if onGetTokens is not provided
            try {
                const graphEndpoint = this.options.config.graphEndpoint;
                const tokens = await this.swapService.getTokensFromGraph(graphEndpoint);
                if (tokens.length > 0) {
                    this.sellToken = tokens[0];
                    if (tokens.length > 1) {
                        this.buyToken = tokens[1];
                    }
                    this.allTokens = tokens;
                    this.updateTokenDisplay();
                    this.updateBalances();
                }
            }
            catch (error) {
                console.error('Error fetching tokens from graph:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tokens from graph';
                this.state.error = errorMessage;
                if (this.options.onErrorEvent) {
                    this.options.onErrorEvent(errorMessage);
                }
            }
        }
    }
    async onSellAmountChange() {
        await this.swapService.waitForPairsLoaded();
        if (this.sellToken &&
            this.buyToken &&
            this.sellAmount &&
            parseFloat(this.sellAmount) > 0 &&
            this.sellToken.address &&
            this.buyToken.address) {
            this.state.isCalculating = true;
            this.updateButtons();
            try {
                const expectedOutput = await this.swapService.calculateExpectedOutput(this.sellToken, this.buyToken, this.sellAmount);
                // Update trade path
                this.tradePath = expectedOutput.path;
                this.buyAmount = expectedOutput.amount;
                this.state.error = null;
                this.updateAmountDisplay();
            }
            catch (error) {
                console.error('Error calculating expected output:', error);
                this.buyAmount = '0';
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.state.error = errorMsg;
                this.updateAmountDisplay();
                if (this.options.onErrorEvent) {
                    this.options.onErrorEvent(errorMsg);
                }
            }
            finally {
                this.state.isCalculating = false;
                this.updateButtons();
            }
        }
        else {
            this.buyAmount = '0';
            this.state.error = null;
            this.updateAmountDisplay();
        }
    }
    onTokenSelect(section) {
        this.tokenModalSection = section;
        this.openTokenModal();
    }
    async openTokenModal() {
        if (!this.allTokens.length) {
            // Fetch tokens if not already loaded
            const graphEndpoint = this.options.config.graphEndpoint;
            this.allTokens = await this.swapService.getTokensFromGraph(graphEndpoint);
        }
        // Set displayedTokens to allTokens initially
        this.displayedTokens = this.allTokens;
        // Create modal overlay
        this.tokenModal = document.createElement('div');
        this.tokenModal.className = 'swap-widget-token-modal-overlay';
        this.tokenModal.innerHTML = `
      <div class="swap-widget-token-modal">
        <div class="token-modal-header">
          <span>Select a token</span>
          <button class="token-modal-close" id="token-modal-close">&times;</button>
        </div>
        <input type="text" class="token-modal-search" id="token-modal-search" placeholder="Search token by symbol or name" />
        <div class="token-modal-list" id="token-modal-list">
          ${this.renderTokenList(this.displayedTokens)}
        </div>
      </div>
    `;
        document.body.appendChild(this.tokenModal);
        // Event listeners
        document.getElementById('token-modal-close')?.addEventListener('click', () => this.closeTokenModal());
        this.tokenModal.querySelectorAll('.token-modal-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const address = el.getAttribute('data-address');
                this.onTokenSelected(address);
            });
        });
        // Add search input event listener with debounce
        const searchInput = document.getElementById('token-modal-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const value = e.target.value;
                const list = this.tokenModal?.querySelector('#token-modal-list');
                if (list) {
                    list.innerHTML = '<div class="token-modal-loading">Loading...</div>';
                }
                if (this.tokenSearchDebounceTimer)
                    clearTimeout(this.tokenSearchDebounceTimer);
                this.tokenSearchDebounceTimer = setTimeout(() => {
                    this.onTokenSearch(value);
                }, 300);
            });
        }
    }
    renderTokenList(tokens) {
        if (!tokens.length) {
            return '<div class="token-modal-empty">No tokens found</div>';
        }
        return tokens.map(token => `
      <div class="token-modal-item" data-address="${token.address}">
        <span class="token-modal-symbol">${token.symbol}</span>
        <span class="token-modal-name">${token.name}</span>
      </div>
    `).join('');
    }
    async onTokenSearch(query) {
        const graphEndpoint = this.options.config.graphEndpoint;
        let filtered = [];
        if (query.trim()) {
            filtered = await this.swapService.getTokensFromGraph(graphEndpoint, query.trim());
        }
        else {
            filtered = this.allTokens;
        }
        this.displayedTokens = filtered;
        const list = this.tokenModal?.querySelector('#token-modal-list');
        if (list) {
            list.innerHTML = this.renderTokenList(filtered);
            list.querySelectorAll('.token-modal-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    const address = el.getAttribute('data-address');
                    this.onTokenSelected(address);
                });
            });
        }
    }
    onTokenSelected(address) {
        const token = this.displayedTokens.find(t => t.address === address);
        if (!token)
            return;
        if (this.tokenModalSection === 'sell') {
            this.sellToken = token;
        }
        else if (this.tokenModalSection === 'buy') {
            this.buyToken = token;
        }
        this.tradePath = [];
        this.updateTokenDisplay();
        this.updateBalances();
        this.closeTokenModal();
        // Recalculate buy amount if both tokens and a sell amount are present
        if (this.sellToken && this.buyToken && this.sellAmount && parseFloat(this.sellAmount) > 0) {
            this.onSellAmountChange();
        }
    }
    closeTokenModal() {
        if (this.tokenModal) {
            document.body.removeChild(this.tokenModal);
            this.tokenModal = null;
            this.tokenModalSection = null;
        }
    }
    onSwitchTokens() {
        const tempToken = this.sellToken;
        const tempAmount = this.sellAmount;
        this.sellToken = this.buyToken;
        this.buyToken = tempToken;
        this.sellAmount = this.buyAmount;
        this.buyAmount = tempAmount;
        // Update trade path
        if (this.sellToken && this.buyToken) {
            this.tradePath = [this.sellToken.address, this.buyToken.address];
        }
        this.updateTokenDisplay();
        this.updateAmountDisplay();
        this.updateBalances();
        // Recalculate buy amount if both tokens and a sell amount are present
        if (this.sellToken && this.buyToken && this.sellAmount && parseFloat(this.sellAmount) > 0) {
            this.onSellAmountChange();
        }
    }
    async onSwapClick() {
        if (!this.canSwap()) {
            return;
        }
        try {
            this.state.isSwapping = true;
            this.updateButtons();
            if (this.sellToken && this.buyToken) {
                // Get fresh quote right before swap to ensure accurate amounts
                const slippageFactor = 10000 - Math.floor(parseFloat(this.settings.maxSlippage) * 100);
                const amountOutBigInt = BigInt(parseUnits(this.buyAmount, this.buyToken.decimals).toString());
                const amountOutMin = (amountOutBigInt * BigInt(slippageFactor)) / BigInt(10000);
                console.log('Swap details:', {
                    sellAmount: this.sellAmount,
                    expectedOutput: amountOutBigInt,
                    slippage: this.settings.maxSlippage + '%',
                    amountOutMin: amountOutMin.toString(),
                    path: this.tradePath
                });
                const txHash = await this.swapService.swapTokens(this.sellToken, this.buyToken, parseUnits(this.sellAmount, this.sellToken.decimals), amountOutMin, this.tradePath, this.settings.swapDeadline, this.settings);
                this.state.transactionHash = txHash;
                this.state.success = true;
                if (this.options.onSwapSuccess) {
                    this.options.onSwapSuccess(txHash);
                }
                // Clear the input amount after a successful swap
                this.sellAmount = '0';
                this.buyAmount = '0';
                this.updateAmountDisplay();
                this.state.isSwapping = false;
                this.updateButtons();
                this.updateBalances();
            }
        }
        catch (error) {
            console.error('Error during swap:', error);
            this.state.error = error instanceof Error ? error.message : 'Unknown error';
            if (this.options.onErrorEvent) {
                this.options.onErrorEvent(this.state.error);
            }
            if (this.options.onSwapError) {
                this.options.onSwapError(this.state.error);
            }
        }
        finally {
            this.state.isSwapping = false;
            this.updateButtons();
        }
    }
    async onConnectWalletClick() {
        if (!this.walletService.isConnected()) {
            try {
                await this.walletService.connect();
            }
            catch (error) {
                console.error('Error connecting wallet:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
                this.state.error = errorMessage;
                if (this.options.onErrorEvent) {
                    this.options.onErrorEvent(errorMessage);
                }
            }
        }
        else {
            this.walletService.disconnect();
        }
    }
    canSwap() {
        return !!(this.walletService.isConnected() &&
            this.sellToken &&
            this.buyToken &&
            this.sellAmount &&
            parseFloat(this.sellAmount) > 0 &&
            this.buyAmount &&
            parseFloat(this.buyAmount) > 0 &&
            !this.state.isCalculating &&
            !this.state.isSwapping);
    }
    getSwapButtonText() {
        if (!this.sellToken || !this.buyToken) {
            return 'Select Tokens';
        }
        if (!this.sellAmount || parseFloat(this.sellAmount) === 0) {
            return 'Enter Amount';
        }
        if (this.state.isCalculating) {
            return 'Loading...';
        }
        if (this.state.isSwapping) {
            return 'Swapping...';
        }
        return 'Swap';
    }
    getConnectWalletButtonText() {
        if (this.walletService.isConnected()) {
            const address = this.walletService.getAddress();
            if (address) {
                return `${address.slice(0, 6)}...${address.slice(-4)}`;
            }
            return 'Disconnect Wallet';
        }
        return 'Connect Wallet';
    }
    updateTokenDisplay() {
        const sellTokenBtn = document.getElementById('sell-token-btn');
        const buyTokenBtn = document.getElementById('buy-token-btn');
        if (sellTokenBtn) {
            sellTokenBtn.textContent = this.sellToken ? this.sellToken.symbol : 'Select Token';
        }
        if (buyTokenBtn) {
            buyTokenBtn.textContent = this.buyToken ? this.buyToken.symbol : 'Select Token';
        }
    }
    updateAmountDisplay() {
        const sellAmountInput = document.getElementById('sell-amount');
        const buyAmountInput = document.getElementById('buy-amount');
        if (sellAmountInput) {
            sellAmountInput.value = this.sellAmount;
        }
        if (buyAmountInput) {
            buyAmountInput.value = this.buyAmount;
        }
    }
    async updateBalances() {
        if (!this.walletService.isConnected()) {
            // Reset balances to 0.0 if wallet is not connected
            const sellBalanceElement = document.getElementById('sell-balance');
            const buyBalanceElement = document.getElementById('buy-balance');
            if (sellBalanceElement) {
                sellBalanceElement.textContent = '0.0';
            }
            if (buyBalanceElement) {
                buyBalanceElement.textContent = '0.0';
            }
            return;
        }
        try {
            // Update sell token balance
            if (this.sellToken) {
                const sellBalanceElement = document.getElementById('sell-balance');
                if (sellBalanceElement) {
                    try {
                        let balance;
                        if (this.sellToken.address === '0x0000000000000000000000000000000000000000') {
                            // Native currency (ETH, KAS, etc.)
                            balance = await this.walletService.getBalance();
                        }
                        else {
                            // ERC20 token
                            balance = await this.walletService.getTokenBalance(this.sellToken.address);
                        }
                        sellBalanceElement.textContent = balance;
                    }
                    catch (error) {
                        console.error('Error getting sell token balance:', error);
                        sellBalanceElement.textContent = '0.0';
                    }
                }
            }
            // Update buy token balance
            if (this.buyToken) {
                const buyBalanceElement = document.getElementById('buy-balance');
                if (buyBalanceElement) {
                    try {
                        let balance;
                        if (this.buyToken.address === '0x0000000000000000000000000000000000000000') {
                            // Native currency (ETH, KAS, etc.)
                            balance = await this.walletService.getBalance();
                        }
                        else {
                            // ERC20 token
                            balance = await this.walletService.getTokenBalance(this.buyToken.address);
                        }
                        buyBalanceElement.textContent = balance;
                    }
                    catch (error) {
                        console.error('Error getting buy token balance:', error);
                        buyBalanceElement.textContent = '0.0';
                    }
                }
            }
        }
        catch (error) {
            console.error('Error updating balances:', error);
        }
    }
    updateSwapButton() {
        if (this.swapButton) {
            this.swapButton.textContent = this.getSwapButtonText();
            this.swapButton.className = `swap-button ${this.canSwap() ? 'enabled' : 'disabled'}`;
        }
    }
    updateButtons() {
        if (this.swapButton) {
            this.swapButton.textContent = this.getSwapButtonText();
            this.swapButton.disabled = !this.canSwap();
        }
    }
    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        // Set up new interval for 20 seconds
        this.updateInterval = setInterval(async () => {
            if (this.state.isSwapping) {
                return;
            }
            try {
                // Update balances
                await this.updateBalances();
                // Update buy amount if we have valid tokens and sell amount
                if (this.sellToken && this.buyToken && this.sellAmount && parseFloat(this.sellAmount) > 0) {
                    await this.onSellAmountChange();
                }
            }
            catch (error) {
                console.error('Error during periodic update:', error);
            }
        }, 20000); // 20 seconds
    }
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    // Public API methods
    async connectWallet() {
        const address = await this.walletService.connect();
        // Set the signer in the swap service
        const signer = this.walletService.getSigner();
        if (signer) {
            this.swapService.setSigner(signer);
        }
        return address;
    }
    disconnectWallet() {
        this.walletService.disconnect();
        // Clear the signer in the swap service
        this.swapService.setSigner(null);
        this.updateButtons();
    }
    setTokens(sellToken, buyToken) {
        this.sellToken = sellToken;
        this.buyToken = buyToken;
        this.updateTokenDisplay();
    }
    setAmounts(sellAmount, buyAmount) {
        this.sellAmount = sellAmount;
        this.buyAmount = buyAmount;
        this.updateAmountDisplay();
    }
    setSettings(settings) {
        this.settings = settings;
    }
    getState() {
        return { ...this.state };
    }
    destroy() {
        // Clean up event listeners and DOM elements
        this.container.innerHTML = '';
        this.stopPeriodicUpdates();
    }
    // Public method to show error dialog (for testing and external use)
    showError(message) {
        this.state.error = message;
        if (this.options.onErrorEvent) {
            this.options.onErrorEvent(message);
        }
    }
    // Public method to connect to a specific wallet provider
    async connectToWalletProvider(provider) {
        return this.walletService.connectToProvider(provider);
    }
}
//# sourceMappingURL=swap-widget.js.map