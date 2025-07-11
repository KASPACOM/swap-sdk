# Kaspa Swap Widget

A lightweight, embeddable swap widget for Kaspa DeFi that can be easily integrated into wallets and dApps.

## Features

- 🔄 Token swapping with Uniswap V2 protocol
- 💰 Support for ERC-20 tokens and native Kaspa
- 🎨 Customizable themes (light/dark)
- 🔌 Simple wallet integration
- ⚡ Real-time price calculations
- 🛡️ Slippage protection
- 📊 Price impact display

## Installation

```bash
npm install @kaspa/swap-widget
```

## Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>Swap Widget Demo</title>
    <link rel="stylesheet" href="dist/styles/swap-widget.css">
</head>
<body>
    <div id="swap-widget"></div>
    <script src="dist/swap-widget.browser.js"></script>
    <script>
        // Example tokens
        const startingTokens = [
            {
                address: '0x0000000000000000000000000000000000000000',
                symbol: 'KAS',
                name: 'Kaspa',
                decimals: 18,
                logoURI: 'https://assets.coingecko.com/coins/images/25751/thumb/kaspa.png'
            },
            {
                address: '0xD33d07ccfEd8038cEd1aa393FbEf7D7dA72be20e',
                symbol: 'USDT',
                name: 'Tether',
                decimals: 6,
                logoURI: 'https://assets.coingecko.com/coins/images/25751/thumb/kaspa.png'
            },
        ];

        // Initialize widget
        let swapWidget;
        async function initializeWidget() {
            if (swapWidget) {
                swapWidget.destroy();
            }
            if (!window.SwapWidget) {
                console.error('SwapWidget not found. Make sure the browser bundle is loaded correctly.');
                return;
            }
            swapWidget = await window.SwapWidget.createSwapWidget({
                containerId: 'swap-widget',
                theme: 'light', // or 'dark'
                // You can use a preset string (e.g. 'kasplex-testnet') or a full config object:
                // config: 'kasplex-testnet',
                /*
                config: {
                    rpcUrl: 'https://your-rpc-url.com',
                    chainId: 12345,
                    routerAddress: '0x...',
                    factoryAddress: '0x...',
                    wethAddress: '0x...',
                    theme: 'light', // optional
                    defaultSlippage: 0.5, // optional
                    defaultDeadline: 20    // optional
                },
                */
                config: 'kasplex-testnet',
                // walletProvider: walletProvider, // Pass the wallet provider if needed
                onConnectWallet: function(walletAddress) {
                    console.log('Wallet connected:', walletAddress);
                },
                onDisconnectWallet: () => console.log('wallet disconnected'),
                onGetTokens: async () => {
                    return startingTokens;
                },
                onSwapSuccess: async (hash) => {
                    console.log('Swap success:', hash);
                    alert('Swap success: ' + hash);
                },
                onErrorEvent: async (error) => {
                    alert('Error: ' + (error?.message || error));
                }
            });
        }
        document.addEventListener('DOMContentLoaded', () => {
            initializeWidget();
        });
    </script>
</body>
</html>
```

### Advanced Usage with Custom Configuration

```javascript
import { createSwapWidget } from '@kaspa/swap-widget';

const widget = await createSwapWidget({
    containerId: 'swap-widget',
    config: 'kasplex'
    // For other networks, you can configure it like this: 
    // {
    //     rpcUrl: 'https://your-rpc-url.com',
    //     chainId: 1,
    //     routerAddress: '0x...',
    //     factoryAddress: '0x...',
    //     wethAddress: '0x...',
    //     defaultSlippage: 0.5,
    //     defaultDeadline: 20
    // },
    onSwapSuccess: (txHash) => {
        console.log('Swap successful:', txHash);
    },
    onSwapError: (error) => {
        console.error('Swap failed:', error);
    },
    onConnectWallet: async () => {
        // Implement your wallet connection logic
        return '0x1234...'; // Return user's address
    },
    onDisconnectWallet: () => {
        // Handle wallet disconnection
    },
    onGetTokens: async () => {
        // Return available tokens
        return [
            {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                name: 'Wrapped Ether',
                decimals: 18,
                balance: 1.5
            },
            {
                address: '0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C',
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                balance: 1000
            }
        ];
    },
    onGetTokenBalance: async (tokenAddress) => {
        // Return token balance for given address
        return '1.5';
    }
});
```

## API Reference

### Types

#### `SwapWidgetNetworkConfig`
```typescript
interface SwapWidgetNetworkConfig {
    rpcUrl: string;
    chainId: number;
    routerAddress: string;
    factoryAddress: string;
    wethAddress: string;
    theme?: 'light' | 'dark';
    defaultSlippage?: number;
    defaultDeadline?: number;
}
```

#### `SwapWidgetOptions`
```typescript
interface SwapWidgetOptions {
    containerId: string;
    config: SwapWidgetNetworkConfig;
    onSwapSuccess?: (txHash: string) => void;
    onSwapError?: (error: string) => void;
    onConnectWallet?: () => Promise<string>;
    onDisconnectWallet?: () => void;
    onGetTokens?: () => Promise<Erc20Token[]>;
    onGetTokenBalance?: (tokenAddress: string) => Promise<string>;
}
```

#### `Erc20Token`
```typescript
interface Erc20Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance?: number;
    rawBalance?: string;
    logoURI?: string;
}
```

### Methods

#### `SwapWidget.connectWallet()`
Connect the user's wallet.

```javascript
const address = await widget.connectWallet();
```

#### `SwapWidget.disconnectWallet()`
Disconnect the user's wallet.

```javascript
widget.disconnectWallet();
```

#### `SwapWidget.setTokens(sellToken, buyToken)`
Set the tokens for the swap.

```javascript
widget.setTokens(sellToken, buyToken);
```

#### `SwapWidget.setAmounts(sellAmount, buyAmount)`
Set the amounts for the swap.

```javascript
widget.setAmounts('1.5', '2500');
```

#### `SwapWidget.setSettings(settings)`
Update swap settings.

```javascript
widget.setSettings({
    maxSlippage: '1.0',
    swapDeadline: 30
});
```

#### `SwapWidget.getState()`
Get the current swap state.

```javascript
const state = widget.getState();
```

#### `SwapWidget.destroy()`
Clean up the widget and remove event listeners.

```javascript
widget.destroy();
```

## Wallet Integration

The swap widget is designed to be easily integrated with any wallet. Here's how to integrate it:

### 1. Wallet Connection
Implement the `onConnectWallet` callback to handle wallet connection:

```javascript
onConnectWallet: async () => {
    // Your wallet connection logic
    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
    });
    return accounts[0];
}
```

### 2. Token Management
Implement the `onGetTokens` callback to provide available tokens:

```javascript
onGetTokens: async () => {
    // Return your token list
    return [
        {
            address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            symbol: 'WETH',
            name: 'Wrapped Ether',
            decimals: 18,
            balance: 1.5
        }
    ];
}
```

### 3. Balance Updates
Implement the `onGetTokenBalance` callback to provide token balances:

```javascript
onGetTokenBalance: async (tokenAddress) => {
    // Get balance for the token
    const balance = await getTokenBalance(tokenAddress);
    return balance.toString();
}
```

## Styling

The widget comes with built-in CSS that can be customized using CSS variables:

```css
.swap-widget {
    --swap-bg: #ffffff;
    --swap-border: #e1e5e9;
    --swap-text: #1a1a1a;
    --swap-primary: #3b82f6;
    --swap-secondary: #f3f4f6;
    --swap-success: #10b981;
    --swap-error: #ef4444;
}
```

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Development

### Building from source

```bash
git clone https://github.com/kaspanet/swap-widget.git
cd swap-widget
npm install
npm run build
```

### Running tests

```bash
npm test
```

### Development mode

```bash
npm run dev
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you have any questions or need help integrating the swap widget, please:

- Open an issue on GitHub
- Check the documentation
- Join our community Discord

## Changelog

### v1.0.0
- Initial release
- Basic swap functionality
- Wallet integration support
- Light/dark themes
- Responsive design 