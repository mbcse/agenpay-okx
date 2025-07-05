#!/usr/bin/env node

/**
 * OKX DEX Integration Demo
 * Demonstrates multi-token payment capabilities with automatic swapping
 */

import { config } from 'dotenv';
import OKXDexService from '../lib/OKXDexService.js';
import X402PayService from '../lib/X402PayService.js';

// Load environment variables
config();

async function demoOKXDexIntegration() {
  console.log(`
🚀 AgenPay × OKX DEX Integration Demo
=====================================
Multi-token payment system with automatic swapping

🎯 Features Demonstrated:
- Accept payments in any supported token (ETH, USDC, USDT, WETH)
- Automatic conversion to recipient's preferred currency
- Optimal pricing through OKX DEX aggregation
- Testnet-safe mock mode for development
  `);

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    const okxDexService = new OKXDexService();
    const x402PayService = new X402PayService();

    // Demo 1: Get supported chains and tokens
    console.log('\n📊 Demo 1: OKX DEX Capabilities');
    console.log('===============================');
    
    const supportedChains = await okxDexService.getSupportedChains();
    console.log(`✅ Supported chains: ${supportedChains.data?.length || 0}`);
    
    const supportedTokens = await okxDexService.getTokensForChain('base-sepolia');
    console.log(`✅ Base Sepolia tokens: ${supportedTokens.data?.length || 0}`);
    
    if (supportedTokens.success && supportedTokens.data.length > 0) {
      console.log('🪙 Sample tokens:');
      supportedTokens.data.slice(0, 3).forEach(token => {
        console.log(`   - ${token.tokenSymbol}: ${token.tokenName} (${token.tokenUnitPrice || 'N/A'} USD)`);
      });
    }

    // Demo 2: Get swap quote
    console.log('\n💱 Demo 2: Swap Quote Calculation');
    console.log('==================================');
    
    const mockWalletAddress = '0x742d35Cc6464f4F4D4Cc7b5A87e1f0E6D5F3D5B8';
    const swapQuote = await okxDexService.getSwapQuote({
      chainId: '84532', // Base Sepolia
      fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
      toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      amount: '1000000000000000000', // 1 ETH in wei
      slippage: '0.5',
      userWalletAddress: mockWalletAddress
    });

    if (swapQuote.success) {
      console.log('✅ Swap quote obtained:');
      console.log(`   From: ${swapQuote.data.fromTokenAmount} ETH`);
      console.log(`   To: ${swapQuote.data.toTokenAmount} USDC`);
      console.log(`   Trade fee: ${swapQuote.data.tradeFee || 'N/A'}`);
      console.log(`   Price impact: ${swapQuote.data.priceImpact || 'N/A'}%`);
    } else {
      console.log('⚠️ Swap quote failed (expected in testnet mock mode)');
    }

    // Demo 3: Payment route calculation
    console.log('\n🧮 Demo 3: Payment Route Calculation');
    console.log('====================================');
    
    const paymentRoute = await okxDexService.calculatePaymentRoute({
      payerPreferredToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
      payeeRequiredToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      amount: '100', // 100 USDC requested
      chainId: '84532',
      userWalletAddress: mockWalletAddress
    });

    console.log('✅ Payment route calculated:');
    console.log(`   Swap required: ${paymentRoute.swapRequired}`);
    console.log(`   Swap possible: ${paymentRoute.swapPossible !== false}`);
    if (paymentRoute.swapRequired) {
      console.log(`   Input amount: ${paymentRoute.inputAmount || 'N/A'}`);
      console.log(`   Output amount: ${paymentRoute.outputAmount || 'N/A'}`);
      console.log(`   Route type: ${paymentRoute.route || 'direct'}`);
    }

    // Demo 4: Multi-token payment request
    console.log('\n💳 Demo 4: Multi-Token Payment Request');
    console.log('======================================');
    
    const mockUserId = 'demo-user-123';
    
    try {
      const multiTokenPayment = await x402PayService.createMultiTokenPaymentRequest({
        userId: mockUserId,
        amount: '100',
        preferredReceiveCurrency: 'USDC',
        acceptedPaymentTokens: ['ETH', 'USDC', 'USDT', 'WETH'],
        network: 'base-sepolia',
        recipientEmail: 'demo@example.com',
        recipientName: 'Demo User',
        description: 'OKX DEX Demo Payment - Multi-token enabled',
        transactionType: 'ask_payment',
        aiPrompt: 'Demo payment request with OKX DEX integration'
      });

      console.log('✅ Multi-token payment request created:');
      console.log(`   Payment ID: ${multiTokenPayment.paymentId}`);
      console.log(`   Payment URL: ${multiTokenPayment.x402PayLink}`);
      console.log(`   Multi-token enabled: ${multiTokenPayment.multiTokenEnabled}`);
      console.log(`   Preferred receive: ${multiTokenPayment.preferredReceiveCurrency}`);
      console.log(`   Accepted tokens: ${multiTokenPayment.acceptedPaymentTokens?.join(', ') || 'N/A'}`);
      console.log(`   Supported chains: ${multiTokenPayment.supportedChains}`);
      console.log(`   Supported tokens: ${multiTokenPayment.supportedTokens}`);

    } catch (paymentError) {
      console.log('⚠️ Multi-token payment creation failed (expected without proper user setup):');
      console.log(`   Error: ${paymentError.message}`);
    }

    // Demo 5: Service statistics
    console.log('\n📈 Demo 5: Service Statistics');
    console.log('=============================');
    
    const stats = await okxDexService.getServiceStats();
    console.log('✅ OKX DEX Service stats:');
    console.log(`   Total swaps: ${stats.totalSwaps}`);
    console.log(`   Completed swaps: ${stats.completedSwaps}`);
    console.log(`   Success rate: ${stats.successRate}%`);
    console.log(`   Supported chains: ${stats.supportedChains}`);
    console.log(`   Testnet mode: ${stats.testnetMode ? '🧪 ENABLED' : '🌐 DISABLED'}`);

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📝 Key Integration Points:');
    console.log('- OKXDexService: Handles token swapping and routing');
    console.log('- X402PayService: Enhanced with multi-token payment support');
    console.log('- AgentPayAgent: New tools for multi-token workflow');
    console.log('- Testnet safe: All operations use mock data in development');

    // Cleanup
    await okxDexService.cleanup();
    await x402PayService.cleanup();

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Usage examples
function printUsageExamples() {
  console.log(`
💡 Usage Examples with AgenPay AI Agent:
========================================

1. Multi-token payment request:
   "Create a payment request for $100 USDC that accepts any token"
   
2. Flexible payment with swapping:
   "I want to request 0.1 ETH but let users pay with any cryptocurrency"
   
3. Optimal pricing request:
   "Request payment for 500 USDT with best swap rates"
   
4. Check payment options:
   "What are the payment options for payment ID x402_multi_..."

🔧 Environment Setup:
====================
# Optional: Add real OKX API credentials for mainnet
OKX_API_KEY=your_okx_api_key
OKX_SECRET_KEY=your_okx_secret_key  
OKX_PASSPHRASE=your_okx_passphrase
OKX_PROJECT_ID=your_project_id

# Testnet mode (default)
NODE_ENV=development
  `);
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting OKX DEX Integration Demo...\n');
  
  demoOKXDexIntegration()
    .then(() => {
      printUsageExamples();
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Demo execution failed:', error);
      process.exit(1);
    });
}

export { demoOKXDexIntegration };