# Kaspa Swap Widget

A lightweight, embeddable swap widget for Kaspa DeFi that can be easily integrated into wallets and dApps.


**Live Demo:**  
Try the widget in your browser:  
[https://kaspacom.github.io/swap-widget/example.html](https://kaspacom.github.io/swap-widget/example.html)



## Features

- 🔄 Token swapping with Uniswap V2 protocol
- 💰 Support for ERC-20 tokens and native Kaspa
- 🎨 Customizable themes (light/dark)
- 🔌 Simple wallet integration
- ⚡ Real-time price calculations
- 🛡️ Slippage protection
<!-- - 📊 Price impact display -->

<!-- ## Installation

```bash
npm install @kaspa/swap-widget
``` -->

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
                initialTokens: startingTokens,
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


### Network Configuration

The widget supports multiple networks via a configuration object or preset string.  
You can use a built-in preset (e.g. `'kasplex-testnet'`) or provide a custom config.

**Preset options and structure are defined in [`src/types/networks.ts`](src/types/networks.ts).**


## API Reference

### Methods

#### `SwapWidget.destroy()`
Clean up the widget and remove event listeners.

```javascript
widget.destroy();
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
- Join our [Telegram](https://t.me/KaspaComOfficial)

## Changelog

### v1.0.0
- Initial release
- Basic swap functionality
- Wallet integration support
- Light/dark themes
- Responsive design 


