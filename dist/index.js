// IMPORTANT: Please include the CSS file manually in your HTML or app:
// <link rel="stylesheet" href="dist/styles/swap-widget.css">
// Export types
export * from './types';
// Export services
export { WalletService } from './services/wallet.service';
export { SwapService } from './services/swap.service';
// Export main widget and default export for UMD builds
import { SwapWidget } from './components/swap-widget';
export { SwapWidget } from './components/swap-widget';
import { NETWORKS } from './types/networks';
/**
 * Create and initialize a new swap widget
 * @param options Configuration options for the swap widget
 * @returns Promise<SwapWidget> The initialized swap widget instance
 */
export async function createSwapWidget(options) {
    let resolvedOptions;
    if (typeof options === 'string') {
        // If a string is provided, treat it as a network key
        const config = NETWORKS[options];
        if (!config)
            throw new Error(`Unknown network key: ${options}`);
        resolvedOptions = {
            containerId: 'swap-widget',
            config,
        };
    }
    else if ('config' in options && typeof options.config === 'string') {
        // If config is a string, treat it as a network key
        const config = NETWORKS[options.config];
        if (!config)
            throw new Error(`Unknown network key: ${options.config}`);
        resolvedOptions = { ...options, config };
    }
    else {
        resolvedOptions = options;
    }
    const widget = new SwapWidget(resolvedOptions);
    return widget;
}
/**
 * Initialize swap widget with default configuration
 * @param containerId The ID of the container element
 * @param config The swap widget configuration
 * @returns Promise<SwapWidget> The initialized swap widget instance
 */
export async function initSwapWidget(containerId, config) {
    let resolvedConfig;
    if (typeof config === 'string') {
        resolvedConfig = NETWORKS[config];
        if (!resolvedConfig)
            throw new Error(`Unknown network key: ${config}`);
    }
    else {
        resolvedConfig = config;
    }
    return createSwapWidget({ containerId, config: resolvedConfig });
}
//# sourceMappingURL=index.js.map