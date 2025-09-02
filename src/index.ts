// IMPORTANT: Please include the CSS file manually in your HTML or app:
// <link rel="stylesheet" href="dist/styles/swap-widget.css">

// Export types
export * from './types';

// Export services
export { WalletService } from './services/wallet.service';
export { SwapService } from './services/swap.service';

// Export headless controller only
import { SwapWidgetController } from './components/swap-widget';
export { SwapWidgetController } from './components/swap-widget';

// Main factory function for easy initialization (headless)
import { SwapWidgetOptions } from './types';
import { NETWORKS, SwapWidgetNetworkConfig } from './types/networks';

/**
 * Create a new headless swap controller
 * @param options Configuration options for the controller
 * @returns SwapWidgetController instance
 */
export function createKaspaComSwapController(options: SwapWidgetOptions) {
  let resolvedOptions: SwapWidgetOptions;
  if ('networkConfig' in options && typeof options.networkConfig === 'string') {
    const networkConfig = NETWORKS[options.networkConfig];
    if (!networkConfig) throw new Error(`Unknown network key: ${options.networkConfig}`);
    resolvedOptions = { ...options, networkConfig };
  } else {
    resolvedOptions = options as SwapWidgetOptions;
  }
  
  return new SwapWidgetController(resolvedOptions);
} 