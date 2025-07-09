/**
 * OKX DEX Service
 * Integrates with OKX DEX API for multi-token payment support
 * Allows users to pay in any supported token while receiving payments in their preferred currency
 */

import axios from 'axios';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export class OKXDexService {
  constructor() {
    this.prisma = new PrismaClient();
    this.isTestnetMode = process.env.NODE_ENV !== 'production';
    
    // OKX DEX API Configuration
    this.config = {
      apiKey: process.env.OKX_API_KEY || 'mock-okx-api-key',
      secretKey: process.env.OKX_SECRET_KEY || 'mock-okx-secret',
      passphrase: process.env.OKX_PASSPHRASE || 'mock-passphrase',
      projectId: process.env.OKX_PROJECT_ID || 'mock-project-id',
      baseUrl: process.env.OKX_DEX_BASE_URL || 'https://web3.okx.com/api/v5/dex',
      testnetMode: this.isTestnetMode
    };

    // Supported chains for DEX operations
    this.supportedChains = {
      'base-sepolia': {
        chainId: '84532', // Base Sepolia testnet
        chainIndex: '84532',
        nativeToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        wrappedNative: '0x4200000000000000000000000000000000000006', // Wrapped ETH on Base
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base Sepolia (mock)
        usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' // USDT on Base Sepolia (mock)
      },
      'ethereum': {
        chainId: '1',
        chainIndex: '1',
        nativeToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      },
      'polygon': {
        chainId: '137',
        chainIndex: '137',
        nativeToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        wrappedNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
      }
    };

    // Popular token addresses for easy access
    this.popularTokens = {
      'base-sepolia': {
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WETH': '0x4200000000000000000000000000000000000006',
        'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'USDT': '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
      }
    };

    console.log(`🔄 OKX DEX Service initialized`);
    console.log(`📊 Mode: ${this.isTestnetMode ? '🧪 TESTNET (Mock)' : '🌐 MAINNET (Live)'}`);
    console.log(`🔗 Supported chains: ${Object.keys(this.supportedChains).join(', ')}`);
  }

  /**
   * Generate authentication headers for OKX API requests
   */
  generateAuthHeaders(timestamp, method, requestPath, queryString = '', body = '') {
    if (this.config.testnetMode || this.config.apiKey === 'mock-okx-api-key') {
      return {
        'Content-Type': 'application/json',
        'X-Mock-Mode': 'true'
      };
    }

    const message = timestamp + method.toUpperCase() + requestPath + queryString + body;
    const signature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(message)
      .digest('base64');

    return {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': this.config.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.config.passphrase,
      'OK-ACCESS-PROJECT': this.config.projectId
    };
  }

  /**
   * Get supported chains from OKX DEX API
   */
  async getSupportedChains() {
    try {
      console.log('🔍 Fetching supported chains from OKX DEX...');

      if (this.config.testnetMode) {
        console.log('🧪 Mock mode: Returning testnet supported chains');
        return {
          success: true,
          data: [
            {
              chainId: '84532',
              chainIndex: '84532',
              chainName: 'Base Sepolia',
              dexTokenApproveAddress: '0x3E3B5F27bbf5CC967E074b70E9f4046e31663181',
              isMainnet: false
            },
            {
              chainId: '11155111',
              chainIndex: '11155111', 
              chainName: 'Ethereum Sepolia',
              dexTokenApproveAddress: '0x3E3B5F27bbf5CC967E074b70E9f4046e31663181',
              isMainnet: false
            }
          ]
        };
      }

      const timestamp = new Date().toISOString();
      const requestPath = '/aggregator/supported/chain';
      const headers = this.generateAuthHeaders(timestamp, 'GET', requestPath);

      const response = await axios.get(`${this.config.baseUrl}${requestPath}`, {
        headers,
        timeout: 10000
      });

      return {
        success: true,
        data: response.data?.data || []
      };
    } catch (error) {
      console.error('❌ Error fetching supported chains:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get available tokens for a specific chain
   */
  async getTokensForChain(chainId) {
    try {
      console.log(`🪙 Fetching tokens for chain ${chainId}...`);

      if (this.config.testnetMode) {
        console.log('🧪 Mock mode: Returning testnet tokens');
        const mockTokens = [
          {
            tokenContractAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            decimals: 18,
            tokenUnitPrice: '2500.00'
          },
          {
            tokenContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            tokenSymbol: 'USDC',
            tokenName: 'USD Coin',
            decimals: 6,
            tokenUnitPrice: '1.00'
          },
          {
            tokenContractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
            tokenSymbol: 'USDT',
            tokenName: 'Tether USD',
            decimals: 6,
            tokenUnitPrice: '1.00'
          },
          {
            tokenContractAddress: '0x4200000000000000000000000000000000000006',
            tokenSymbol: 'WETH',
            tokenName: 'Wrapped Ether',
            decimals: 18,
            tokenUnitPrice: '2500.00'
          }
        ];

        return {
          success: true,
          data: mockTokens
        };
      }

      const timestamp = new Date().toISOString();
      const requestPath = '/aggregator/all-tokens';
      const queryParams = new URLSearchParams({ chainId });
      const headers = this.generateAuthHeaders(timestamp, 'GET', requestPath, `?${queryParams}`);

      const response = await axios.get(`${this.config.baseUrl}${requestPath}?${queryParams}`, {
        headers,
        timeout: 10000
      });

      return {
        success: true,
        data: response.data?.data || []
      };
    } catch (error) {
      console.error(`❌ Error fetching tokens for chain ${chainId}:`, error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get swap quote between two tokens
   */
  async getSwapQuote({
    chainId,
    fromTokenAddress,
    toTokenAddress,
    amount,
    slippage = '0.5',
    userWalletAddress
  }) {
    try {
      console.log(`💱 Getting swap quote: ${amount} tokens from ${fromTokenAddress} to ${toTokenAddress} on chain ${chainId}`);

      if (this.config.testnetMode) {
        console.log('🧪 Mock mode: Generating mock swap quote');
        
        // Simulate different conversion rates
        let outputAmount = amount;
        const fromSymbol = this.getTokenSymbol(fromTokenAddress, chainId);
        const toSymbol = this.getTokenSymbol(toTokenAddress, chainId);
        
        // Mock conversion logic
        if (fromSymbol === 'ETH' && toSymbol === 'USDC') {
          outputAmount = (parseFloat(amount) * 2500).toString(); // 1 ETH = 2500 USDC
        } else if (fromSymbol === 'USDC' && toSymbol === 'ETH') {
          outputAmount = (parseFloat(amount) / 2500).toString(); // 2500 USDC = 1 ETH
        } else if (fromSymbol === 'USDC' && toSymbol === 'USDT') {
          outputAmount = (parseFloat(amount) * 0.999).toString(); // Small fee
        }

        const mockQuote = {
          chainId,
          fromTokenAddress,
          toTokenAddress,
          fromTokenAmount: amount,
          toTokenAmount: outputAmount,
          estimatedGas: '21000',
          tradeFee: '0.1',
          priceImpact: '0.01',
          route: [
            {
              dexName: 'Uniswap V3',
              percentage: 100
            }
          ],
          slippage
        };

        return {
          success: true,
          data: mockQuote
        };
      }

      const timestamp = new Date().toISOString();
      const requestPath = '/aggregator/quote';
      const queryParams = new URLSearchParams({
        chainId,
        fromTokenAddress,
        toTokenAddress,
        amount,
        slippage,
        userWalletAddress
      });
      
      const headers = this.generateAuthHeaders(timestamp, 'GET', requestPath, `?${queryParams}`);

      const response = await axios.get(`${this.config.baseUrl}${requestPath}?${queryParams}`, {
        headers,
        timeout: 15000
      });

      if (response.data?.code !== '0') {
        throw new Error(`OKX API Error: ${response.data?.msg || 'Unknown error'}`);
      }

      return {
        success: true,
        data: response.data?.data?.[0] || null
      };
    } catch (error) {
      console.error('❌ Error getting swap quote:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Execute token swap
   */
  async executeSwap({
    chainId,
    fromTokenAddress,
    toTokenAddress,
    amount,
    slippage = '0.5',
    userWalletAddress,
    paymentRequestId = null
  }) {
    try {
      console.log(`🔄 Executing swap: ${amount} tokens from ${fromTokenAddress} to ${toTokenAddress}`);

      if (this.config.testnetMode) {
        console.log('🧪 Mock mode: Simulating swap execution');
        
        // Generate mock transaction data
        const mockSwapResult = {
          success: true,
          transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
          fromTokenAmount: amount,
          toTokenAmount: this.calculateMockSwapOutput(fromTokenAddress, toTokenAddress, amount, chainId),
          gasUsed: '21000',
          gasPrice: '20000000000', // 20 gwei
          tradeFee: '0.1',
          timestamp: new Date().toISOString(),
          explorerUrl: `https://sepolia.basescan.org/tx/0x${crypto.randomBytes(32).toString('hex')}`
        };

        // Log the swap for demo purposes
        if (paymentRequestId) {
          await this.logSwapTransaction({
            paymentRequestId,
            fromToken: fromTokenAddress,
            toToken: toTokenAddress,
            fromAmount: amount,
            toAmount: mockSwapResult.toTokenAmount,
            transactionHash: mockSwapResult.transactionHash,
            chainId,
            status: 'completed'
          });
        }

        console.log(`✅ Mock swap completed:`, mockSwapResult);
        return mockSwapResult;
      }

      // First get a quote
      const quoteResult = await this.getSwapQuote({
        chainId,
        fromTokenAddress,
        toTokenAddress,
        amount,
        slippage,
        userWalletAddress
      });

      if (!quoteResult.success) {
        throw new Error(`Failed to get quote: ${quoteResult.error}`);
      }

      // Execute the swap using OKX DEX API
      const timestamp = new Date().toISOString();
      const requestPath = '/aggregator/swap';
      const queryParams = new URLSearchParams({
        chainId,
        fromTokenAddress,
        toTokenAddress,
        amount,
        slippage,
        userWalletAddress
      });

      const headers = this.generateAuthHeaders(timestamp, 'GET', requestPath, `?${queryParams}`);

      const response = await axios.get(`${this.config.baseUrl}${requestPath}?${queryParams}`, {
        headers,
        timeout: 30000
      });

      if (response.data?.code !== '0') {
        throw new Error(`OKX Swap Error: ${response.data?.msg || 'Unknown error'}`);
      }

      const swapData = response.data?.data?.[0];
      if (!swapData) {
        throw new Error('No swap data received from OKX API');
      }

      return {
        success: true,
        data: swapData,
        transactionData: swapData.data // Transaction data to be broadcast
      };

    } catch (error) {
      console.error('❌ Error executing swap:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate optimal payment route with swapping
   */
  async calculatePaymentRoute({
    payerPreferredToken,
    payeeRequiredToken,
    amount,
    chainId,
    userWalletAddress
  }) {
    try {
      console.log(`🧮 Calculating payment route from ${payerPreferredToken} to ${payeeRequiredToken}`);

      // If tokens are the same, no swap needed
      if (payerPreferredToken.toLowerCase() === payeeRequiredToken.toLowerCase()) {
        return {
          swapRequired: false,
          directPayment: true,
          inputAmount: amount,
          outputAmount: amount,
          route: 'direct'
        };
      }

      // Get swap quote
      const quoteResult = await this.getSwapQuote({
        chainId,
        fromTokenAddress: payerPreferredToken,
        toTokenAddress: payeeRequiredToken,
        amount,
        userWalletAddress
      });

      if (!quoteResult.success) {
        return {
          swapRequired: true,
          swapPossible: false,
          error: quoteResult.error
        };
      }

      return {
        swapRequired: true,
        swapPossible: true,
        inputAmount: amount,
        outputAmount: quoteResult.data.toTokenAmount,
        estimatedGas: quoteResult.data.estimatedGas,
        tradeFee: quoteResult.data.tradeFee,
        priceImpact: quoteResult.data.priceImpact,
        route: quoteResult.data.route,
        slippage: quoteResult.data.slippage
      };

    } catch (error) {
      console.error('❌ Error calculating payment route:', error.message);
      return {
        swapRequired: true,
        swapPossible: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Get token symbol from address
   */
  getTokenSymbol(tokenAddress, chainId) {
    const chainTokens = this.popularTokens[chainId] || this.popularTokens['base-sepolia'];
    
    for (const [symbol, address] of Object.entries(chainTokens)) {
      if (address.toLowerCase() === tokenAddress.toLowerCase()) {
        return symbol;
      }
    }
    
    return 'UNKNOWN';
  }

  /**
   * Helper: Calculate mock swap output for testnet
   */
  calculateMockSwapOutput(fromToken, toToken, amount, chainId) {
    const fromSymbol = this.getTokenSymbol(fromToken, chainId);
    const toSymbol = this.getTokenSymbol(toToken, chainId);
    
    // Mock exchange rates
    const rates = {
      'ETH_USDC': 2500,
      'ETH_USDT': 2500,
      'USDC_ETH': 1/2500,
      'USDT_ETH': 1/2500,
      'USDC_USDT': 0.999,
      'USDT_USDC': 1.001,
      'WETH_ETH': 1,
      'ETH_WETH': 1
    };

    const rateKey = `${fromSymbol}_${toSymbol}`;
    const rate = rates[rateKey] || 1;
    
    return (parseFloat(amount) * rate * 0.997).toString(); // 0.3% fee simulation
  }

  /**
   * Log swap transaction to database
   */
  async logSwapTransaction(swapData) {
    try {
      await this.prisma.transaction.create({
        data: {
          id: crypto.randomUUID(),
          type: 'SWAP',
          status: swapData.status || 'PENDING',
          amount: parseFloat(swapData.fromAmount),
          currency: this.getTokenSymbol(swapData.fromToken, swapData.chainId),
          toAddress: swapData.toToken,
          fromAddress: swapData.fromToken,
          txHash: swapData.transactionHash,
          network: swapData.chainId,
          metadata: JSON.stringify({
            paymentRequestId: swapData.paymentRequestId,
            fromToken: swapData.fromToken,
            toToken: swapData.toToken,
            fromAmount: swapData.fromAmount,
            toAmount: swapData.toAmount,
            swapProvider: 'OKX_DEX'
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`📝 Swap transaction logged: ${swapData.transactionHash}`);
    } catch (error) {
      console.error('❌ Error logging swap transaction:', error.message);
    }
  }

  /**
   * Get swap transaction status
   */
  async getSwapStatus(transactionHash) {
    try {
      if (this.config.testnetMode) {
        // Mock status check
        return {
          success: true,
          status: 'completed',
          confirmations: 12,
          timestamp: new Date().toISOString()
        };
      }

      // In real implementation, check transaction status on blockchain
      // This would typically involve web3 calls to check transaction receipt
      return {
        success: true,
        status: 'pending',
        confirmations: 0
      };
    } catch (error) {
      console.error('❌ Error checking swap status:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats() {
    try {
      const swapCount = await this.prisma.transaction.count({
        where: { type: 'SWAP' }
      });

      const completedSwaps = await this.prisma.transaction.count({
        where: { 
          type: 'SWAP',
          status: 'COMPLETED'
        }
      });

      return {
        totalSwaps: swapCount,
        completedSwaps,
        successRate: swapCount > 0 ? (completedSwaps / swapCount * 100).toFixed(2) : 0,
        supportedChains: Object.keys(this.supportedChains).length,
        testnetMode: this.config.testnetMode
      };
    } catch (error) {
      console.error('❌ Error getting service stats:', error.message);
      return {
        totalSwaps: 0,
        completedSwaps: 0,
        successRate: 0,
        supportedChains: Object.keys(this.supportedChains).length,
        testnetMode: this.config.testnetMode
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.prisma.$disconnect();
      console.log('🧹 OKX DEX Service cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
    }
  }
}

export default OKXDexService;