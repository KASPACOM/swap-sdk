export interface SwapWidgetNetworkConfig {
    name: string;
    chainId: number;
    rpcUrl: string;
    routerAddress: string;
    factoryAddress: string;
    wethAddress: string;
    graphEndpoint: string;
    theme?: 'light' | 'dark';
    defaultSlippage?: number;
    defaultDeadline?: number;
    blockExplorerUrl?: string;
    additionalJsonRpcApiProviderOptionsOptions?: any;
}
export declare const NETWORKS: Record<string, SwapWidgetNetworkConfig>;
//# sourceMappingURL=networks.d.ts.map