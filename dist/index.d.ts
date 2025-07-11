export * from './types';
export { WalletService } from './services/wallet.service';
export { SwapService } from './services/swap.service';
import { SwapWidget } from './components/swap-widget';
export { SwapWidget } from './components/swap-widget';
import { SwapWidgetOptions } from './types';
import { NETWORKS, SwapWidgetNetworkConfig } from './types/networks';
/**
 * Create and initialize a new swap widget
 * @param options Configuration options for the swap widget
 * @returns Promise<SwapWidget> The initialized swap widget instance
 */
export declare function createSwapWidget(options: SwapWidgetOptions | string): Promise<SwapWidget>;
/**
 * Initialize swap widget with default configuration
 * @param containerId The ID of the container element
 * @param config The swap widget configuration
 * @returns Promise<SwapWidget> The initialized swap widget instance
 */
export declare function initSwapWidget(containerId: string, config: SwapWidgetNetworkConfig | keyof typeof NETWORKS): Promise<SwapWidget>;
//# sourceMappingURL=index.d.ts.map