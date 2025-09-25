# Kaspa Swap SDK

A lightweight, headless swap SDK for Kaspa DeFi powered by Uniswap V2. Build your own UI and use the SDK to handle quotes, approvals, and swaps.

# Examples
You can find some examples of how to use the SDK in the [swap-sdk-examples](https://github.com/KASPACOM/swap-sdk-examples) repository.


## Features

- 🔄 Token swapping with Uniswap V2 protocol
- 💰 Support for ERC-20 tokens and native Kaspa wrappers
- 🎛️ Headless controller: bring your own UI
- 🔌 Simple wallet integration (EIP-1193 providers)
- ⚡ Real-time quote calculations
- 🛡️ Slippage protection and deadlines


## Installation

```bash
npm install @kaspacom/swap-sdk
```



## Quick Start

### Create the headless controller

```typescript
import {
  createKaspaComSwapController,
  LoaderStatuses,
  Erc20Token,
} from 'swap-widget';

const controller = createKaspaComSwapController({
  networkConfig: 'kasplex-testnet',
  walletProvider: window.ethereum, // any EIP-1193 provider
  onChange: async (state, patch) => {
    console.log('state changed', patch, state);
    // Render your UI from state.computed, state.loader, etc.
  },
});
```

### Provide inputs and get a quote

```typescript
const kas: Erc20Token = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'KAS',
  name: 'Kaspa',
  decimals: 18,
};

const usdt: Erc20Token = {
  address: '0xD33d07ccfEd8038cEd1aa393FbEf7D7dA72be20e',
  symbol: 'USDT',
  name: 'Tether',
  decimals: 6,
};

await controller.setData({
  fromToken: kas,
  toToken: usdt,
  amount: 1.0,             // user-entered number
  isOutputAmount: false,    // false = amount is input; true = amount is desired output (How much the user will receive)
  settings: { maxSlippage: '0.5', swapDeadline: 20 },
});

// Quote results are in controller.getState().computed
const { computed } = controller.getState();
console.log('computed amounts', computed);
```

### Connect wallet, approve if needed, and swap

```typescript
await controller.connectWallet();

// Optional: call approve explicitly
await controller.approveIfNeeded();

// Perform the swap
const txHash = await controller.swap();
console.log('Swap TX hash:', txHash);
```

### Load tokens from the subgraph (for token pickers)

```typescript
const tokens = await controller.getTokensFromGraph(100, 'kas');
console.log(tokens);
```


## API Reference

### createKaspaComSwapController(options)
Creates and returns a `SwapSdkController` instance. Accepts either a preset string for `networkConfig` or a full `SwapSdkNetworkConfig` object.

- **options.networkConfig**: `'kasplex-testnet'` or `SwapSdkNetworkConfig`
- **options.walletProvider**: EIP-1193 provider (e.g., `window.ethereum`)
- **options.partnerKey?**: Optional partner key string
- **options.onChange?**: `(state, patch) => Promise<void>` callback invoked on any state change
- **options.refreshPairsInterval?**: Optional Number of milliseconds to refresh pairs from the subgraph (for updated quotes)
- **options.updateQuoteAfterRefreshPairs?**: Optional boolean to update quote after refreshing pairs

Returns: `SwapSdkController`


### class SwapSdkController

- **constructor(options: SwapSdkOptions)**: Normally use the factory `createKaspaComSwapController`.
- **connectWallet(injectedProvider?: Eip1193Provider): Promise<string>**
  - Connects the wallet and sets signer on the swap service.
  - Returns the connected address.
- **disconnectWallet(): void**
  - Disconnects the wallet and clears signer.
- **getState(): SwapControllerOutput**
  - Returns the current controller state.
- **setData(input: Partial<SwapControllerInput>): Promise<SwapControllerOutput>**
  - Merges provided input, triggers a quote calculation if possible, and returns updated state.
- **calculateQuoteIfNeeded(): Promise<void>**
  - Re-calculates quote if `fromToken`, `toToken`, and `amount` are valid.
- **approveIfNeeded(): Promise<string | undefined>**
  - If allowance is insufficient, submits approval transaction and waits for confirmation.
  - Returns approval transaction hash when submitted, otherwise `undefined` if already approved.
- **swap(): Promise<string>**
  - Executes the swap using last computed trade info and amounts. Returns swap transaction hash.
- **getPartnerFee(): Promise<number>**
  - Fetches the current partner fee in percentage (bps/divisor).
- **getTokensFromGraph(limit?: number, search?: string): Promise<any[]>**
  - Queries the subgraph for tokens. Use for token lists/search.
- **refreshTokensAndUpdateQuote(forceQuoteUpdate = false): Promise<void>**
  - Refreshes tokens from the subgraph and updates quote if configured. Needed to be called after swap completed or once in a while to get updated quotes.
- **destroy(): void**
  - Releases all resources from the controller, needs to be called after done using the controller.

## Types

All types are exported from `swap-widget`.

- **Erc20Token**
  - `address: string`
  - `symbol: string`
  - `name: string`
  - `decimals: number`

- **SwapSettings**
  - `maxSlippage: string` (e.g., `'0.5'` for 0.5%)
  - `swapDeadline: number` (minutes)

- **SwapSdkOptions**
  - `networkConfig: SwapSdkNetworkConfig | string`
  - `walletProvider: any` (EIP-1193)
  - `partnerKey?: string`
  - `onChange?: (state: SwapControllerOutput, patch: Partial<SwapControllerOutput>) => Promise<void>`

- **SwapControllerInput** (used with `setData`)
  - `fromToken?: Erc20Token | null`
  - `toToken?: Erc20Token | null`
  - `amount?: number` (user-entered number)
  - `isOutputAmount?: boolean` (false = `amount` is input; true = `amount` is desired output)
  - `settings?: Partial<SwapSettings>`

- **LoaderStatuses**
  - `CALCULATING_QUOTE = 1`
  - `APPROVING = 2`
  - `SWAPPING = 3`

- **ComputedAmounts** (found in `SwapControllerOutput.computed`)

  - `amountIn: string`  
    The input amount as entered by the user, formatted for display.

  - `amountOut: string`  
    The output amount as calculated for the user, formatted for display.

  - `amountInRaw: string`  
    The exact input amount (in smallest token units, e.g. wei) that will be sent to the swap contract.

  - `amountOutRaw: string`  
    The exact output amount (in smallest token units, e.g. wei) that will be received from the swap contract.

  - `maxAmountIn?: string`  
    (Optional) The maximum input amount the user need to send to receive the desired output amount. Only present if `isOutputAmount` is `true`.

  - `minAmountOut?: string`  
    (Optional) The minimum output amount the user will receive, accounting for slippage.  Only present if `isOutputAmount` is `false`.

  - `maxAmountInRaw?: string`  
    (Optional) The raw (smallest units) value of `maxAmountIn`.

  - `minAmountOutRaw?: string`  
    (Optional) The raw (smallest units) value of `minAmountOut`.

- **SwapControllerOutput**
  - `error?: string`
  - `txHash?: string` (Swap tx hash)
  - `approveTxHash?: string` (Approval transaction tx hash)
  - `path?: Token[]` (Trade path)
  - `computed?: ComputedAmounts`
  - `loader: LoaderStatuses | null`

- **SwapSdkNetworkConfig** (also see presets in `NETWORKS`)
  - `name: string`
  - `chainId: number`
  - `rpcUrl: string`
  - `routerAddress: string`
  - `factoryAddress: string`
  - `proxyAddress?: string`
  - `graphEndpoint: string`
  - `blockExplorerUrl?: string`
  - `additionalJsonRpcApiProviderOptionsOptions?: any`
  - `nativeToken: Erc20Token`  
    The native token of the network (KAS).
  - `wrappedToken: Erc20Token`  
    The wrapped native token (WKAS).

- **NETWORKS**
  - Preset map of network keys to `SwapSdkNetworkConfig` objects. Includes `'kasplex-testnet'`.


## Usage Patterns

- **Exact input vs exact output**
  - Set `isOutputAmount` to `false` to quote "sell X get best Y".
  - Set `isOutputAmount` to `true` to quote "get exactly X spend up to Y".
- **React integration**
  - Call `setData` on input changes; render from `controller.getState()`.
  - Use `state.loader` to show spinners: `LoaderStatuses.CALCULATING_QUOTE`, `APPROVING`, `SWAPPING`.
  

## Development

```bash
git clone https://github.com/kaspacom/swap-widget.git
cd swap-widget
npm install
npm run build
```


## License

MIT License - see `LICENSE`.


## Support

- Open an issue on GitHub
- Join our Telegram: https://t.me/KaspaComOfficial


