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
    badckendApiUrl: 'https://dev-api-defi.kaspa.com',
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
    },
    isTestnet: true,
    defiApiNetworkName: 'kasplex',
  },
  'igra-testnet': {
    name: 'Igra Caravel',
    chainId: 19416,
    rpcUrl: 'https://caravel.igralabs.com:8545',
    routerAddress: '0x9a5514828a3c2b36920b7c4fe0d6bd7fe8e8924f',
    factoryAddress: '0x1a8136A6da6CA7fe8960c4d098d90Ba2BA712B9F',
    proxyAddress: '0x47f80b6d7071b7738d6dd9d973d7515ce753e9d9',
    badckendApiUrl: 'https://dev-api-defi.kaspa.com',
    blockExplorerUrl: 'https://explorer.caravel.igralabs.com',
    additionalJsonRpcApiProviderOptionsOptions: {
        batchMaxSize: 0,
    },
    wrappedToken: {
      address: '0x65C280485cA2Ea32aB6A684E2e0646ff1F842A80',
      decimals: 18,
      name: 'Igra Wrapped Kaspa',
      symbol: 'IWKAS',
    },
    nativeToken: {
      address: ethers.ZeroAddress,
      decimals: 18,
      name: 'Igra Kaspa',
      symbol: 'IKAS',
    },
    isTestnet: true,
    defiApiNetworkName: 'igra',
  },
  'kasplex': {
    name: 'Kasplex',
    chainId: 202555,
    rpcUrl: 'https://evmrpc.kasplex.org',
    routerAddress: '0x3a1f0bD164fe9D8fa18Da5abAB352dC634CA5F10',
    factoryAddress: '0xa9CBa43A407c9Eb30933EA21f7b9D74A128D613c',
    proxyAddress: '0x4c5BEaAE83577E3a117ce2F477fC42a1EA39A8a3',
    badckendApiUrl: 'https://api-defi.kaspa.com',
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
    },
    defiApiNetworkName: 'kasplex',
  }
  // Add more networks as needed
}; 