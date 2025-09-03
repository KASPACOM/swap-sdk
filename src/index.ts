// Export types
export * from './types';

// Export services
export { WalletService } from './services/wallet.service';
export { SwapService } from './services/swap.service';

// Export headless controller only
import { SwapSdkController } from './controllers/swap-sdk.controller';
export { SwapSdkController } from './controllers/swap-sdk.controller';

// Main factory function for easy initialization (headless)
import { SwapSdkOptions } from './types';
import { NETWORKS } from './types/networks';
export { NETWORKS} from './types/networks';

/**
 * Create a new headless swap controller
 * @param options Configuration options for the controller
 * @returns SwapSdkController instance
 */
export function createKaspaComSwapController(options: SwapSdkOptions): SwapSdkController {
  let resolvedOptions: SwapSdkOptions;
  if ('networkConfig' in options && typeof options.networkConfig === 'string') {
    const networkConfig = NETWORKS[options.networkConfig];
    if (!networkConfig) throw new Error(`Unknown network key: ${options.networkConfig}`);
    resolvedOptions = { ...options, networkConfig };
  } else {
    resolvedOptions = options as SwapSdkOptions;
  }
  
  return new SwapSdkController(resolvedOptions);
} 