// IMPORTANT: Please include the CSS file manually in your HTML or app:
// <link rel="stylesheet" href="dist/styles/swap-widget.css">

// Export types
export * from './types';

// Export services
export { WalletService } from './services/wallet.service';
export { SwapService } from './services/swap.service';

// Export headless controller only
import { SwapSdkController } from './controllers/swap-sdk.controller';
export { SwapSdkController } from './controllers/swap-sdk.controller';

// Main factory function for easy initialization (headless)
import { SwapWidgetOptions } from './types';
import { NETWORKS } from './types/networks';

/**
 * Create a new headless swap controller
 * @param options Configuration options for the controller
 * @returns SwapSdkController instance
 */
export function createKaspaComSwapController(options: SwapWidgetOptions): SwapSdkController {
  let resolvedOptions: SwapWidgetOptions;
  if ('networkConfig' in options && typeof options.networkConfig === 'string') {
    const networkConfig = NETWORKS[options.networkConfig];
    if (!networkConfig) throw new Error(`Unknown network key: ${options.networkConfig}`);
    resolvedOptions = { ...options, networkConfig };
  } else {
    resolvedOptions = options as SwapWidgetOptions;
  }
  
  return new SwapSdkController(resolvedOptions);
} 