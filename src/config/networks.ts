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
  'kasplex': {
    name: 'Kasplex',
    chainId: 202555,
    rpcUrl: 'https://evmrpc.kasplex.org',
    routerAddress: '0x3a1f0bD164fe9D8fa18Da5abAB352dC634CA5F10',
    factoryAddress: '0xa9CBa43A407c9Eb30933EA21f7b9D74A128D613c',
    proxyAddress: '0x4c5BEaAE83577E3a117ce2F477fC42a1EA39A8a3',
    graphEndpoint: 'https://graph-kasplex.kaspa.com/subgraphs/name/kasplex-v2-core',
    blockExplorerUrl: 'https://explorer.kasplex.org',
    additionalJsonRpcApiProviderOptionsOptions: {
      batchMaxCount: 1,
      batchMaxSize: 1,
      batchStallTime: 0,
    },
    wrappedToken: {
      address: '0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e',
      decimals: 18,
      name: 'Wrapped KAS',
      symbol: 'WKAS',
    },
    nativeToken: {
      address: ethers.ZeroAddress,
      decimals: 18,
      name: 'Kasplex Kaspa',
      symbol: 'KAS',
    }
  }
  // Add more networks as needed
}; 