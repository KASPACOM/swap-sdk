export interface SwapWidgetNetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  routerAddress: string;
  factoryAddress: string;
  proxyAddress?: string;
  wethAddress: string;
  graphEndpoint: string;
  theme?: 'light' | 'dark';
  defaultSlippage?: number;
  defaultDeadline?: number;
  blockExplorerUrl?: string;
  additionalJsonRpcApiProviderOptionsOptions?: any;
}

export const NETWORKS: Record<string, SwapWidgetNetworkConfig> = {
  'kasplex-testnet': {
    name: 'Kasplex Test',
    chainId: 167012,
    rpcUrl: 'https://rpc.kasplextest.xyz',
    routerAddress: '0x5A410f79f58a11344E3523d99820Cf231bc888bd',
    factoryAddress: '0x772B3321B37C1a9aeF0Da1B5A6453E1C2A264beF',
    proxyAddress: '0xbE448f863d2bB7bCcD9185A854DF2D8d63498dB0',
    wethAddress: '0x654A3287c317D4Fc6e8482FeF523Dc4572b563AA',
    graphEndpoint: 'https://dev-graph-kasplex.kaspa.com/subgraphs/name/uniswap-v2',
    blockExplorerUrl: 'https://explorer.testnet.kasplextest.xyz',
    defaultSlippage: 0.5,
    defaultDeadline: 20,
    additionalJsonRpcApiProviderOptionsOptions: {
      batchMaxCount: 1,
      batchMaxSize: 1,
      batchStallTime: 0,
    },
  },
  // Add more networks as needed
}; 