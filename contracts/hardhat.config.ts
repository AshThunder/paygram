import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const FUNDING_KEY = process.env.FUNDING_PRIVATE_KEY || '';
const accounts = FUNDING_KEY ? [FUNDING_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    arbitrumSepolia: {
      url: process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts,
    },
    arbitrum: {
      url: process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      chainId: 42161,
      accounts,
    },
  },
  etherscan: {
    // Single key → Etherscan API v2 (works for Arbitrum One via chainId 42161)
    apiKey: process.env.ARBISCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === '1',
    currency: 'USD',
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
