import { ethers } from "ethers";
import { SwapSdkNetworkConfig } from "../types";

export const NETWORKS: Record<string, SwapSdkNetworkConfig> = {
  'kasplex-testnet': {
    name: 'Kasplex Test',
    chainId: 167012,
    rpcUrl: 'https://rpc.kasplextest.xyz',
    routerAddress: '0x81Cc4e7DbC652ec9168Bc2F4435C02d7F315148e',
    factoryAddress: '0x89d5842017ceA7dd18D10EE6c679cE199d2aD99E',
    proxyAddress: '0x5B7e7830851816f8ad968B0e0c336bd50b4860Ad',
    graphEndpoint: 'https://dev-graph-kasplex.kaspa.com/subgraphs/name/kasplex-testnet-new-v2-core',
    blockExplorerUrl: 'https://explorer.testnet.kasplextest.xyz',
    additionalJsonRpcApiProviderOptionsOptions: {
      batchMaxCount: 1,
      batchMaxSize: 1,
      batchStallTime: 0,
    },
    wrappedToken: {
      address: '0xf40178040278E16c8813dB20a84119A605812FB3',
      decimals: 18,
      name: 'Wrapped Kasplex Kaspa',
      symbol: 'WKAS',
    },
    nativeToken: {
      address: ethers.ZeroAddress,
      decimals: 18,
      name: 'Kasplex Kaspa',
      symbol: 'KAS',
    }
  },
  // Add more networks as needed
}; 