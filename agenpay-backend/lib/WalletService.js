/**
 * CDP Wallet Service for AgenPay
 * Simple wrapper for Coinbase Developer Platform using CDP SDK
 * Stores only wallet name and address - CDP handles private keys remotely
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import { PrismaClient } from '@prisma/client';
import dotenv from "dotenv";

dotenv.config();

export class WalletService {
  constructor() {
    this.prisma = new PrismaClient();
    this.cdp = null;
    this.initialized = false;
    this.setupCDP();
  }

  /**
   * Setup CDP Client
   */
  setupCDP() {
    try {
      this.cdp = new CdpClient();
      this.initialized = true;
      console.log('✅ CDP Wallet Service initialized');
    } catch (error) {
      console.error('❌ Error initializing CDP:', error.message);
      throw error;
    }
  }

  /**
   * Create new wallet for user
   */
  async createWallet(userId, network = 'base-sepolia') {
    try {
      if (!this.initialized) {
        throw new Error('CDP not initialized');
      }

      console.log(`💳 Creating CDP wallet for user ${userId} on ${network}`);

      // Create EVM account using CDP
      const account = await this.cdp.evm.createAccount();
      
      const walletData = {
        walletId: account.id || `user_${userId}_account`,
        address: account.address,
        network: network,
      };

      // Update user record with wallet info
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          walletId: walletData.walletId,
          walletAddress: walletData.address,
          // walletNetwork removed - field doesn't exist in User model
        },
      });

      // Request faucet funds for testnet
      if (network.includes('sepolia') || network.includes('testnet')) {
        try {
          await this.cdp.evm.requestFaucet({
            address: walletData.address,
            network: network,
            token: 'eth',
          });
          console.log(`🚰 Faucet funds requested for ${walletData.address}`);
        } catch (faucetError) {
          console.warn('⚠️ Faucet funding failed:', faucetError.message);
        }
      }

      console.log(`✅ Wallet created for user ${userId}: ${walletData.address}`);
      return walletData;
    } catch (error) {
      console.error(`❌ Error creating wallet for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get wallet for user
   */
  async getWallet(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletId: true, walletAddress: true },
      });

      if (!user?.walletAddress) {
        throw new Error('Wallet not found for user');
      }

      return {
        walletId: user.walletId,
        address: user.walletAddress,
        network: 'base-sepolia', // Default network since we don't store it in User model
      };
    } catch (error) {
      console.error(`❌ Error getting wallet for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(userId) {
    try {
      const { address, network } = await this.getWallet(userId);
      
      // Get balance from CDP
      const balances = await this.cdp.evm.listTokenBalances({
        address: address,
        network: network,
      });
      
      // Process balance response
      const balance = { ETH: '0', USD: '0' };
      
      if (balances && Array.isArray(balances)) {
        for (const tokenBalance of balances) {
          const symbol = tokenBalance.symbol || tokenBalance.asset_id || 'ETH';
          const amount = tokenBalance.amount || tokenBalance.balance || '0';
          if (symbol.toUpperCase() === 'ETH') {
            balance.ETH = amount;
            balance.USD = (parseFloat(amount) * 2000).toFixed(2); // Rough estimate
          }
        }
      }
      
      return balance;
    } catch (error) {
      console.error(`❌ Error getting wallet balance for user ${userId}:`, error);
      return { ETH: '0', USD: '0' };
    }
  }

  /**
   * Send cryptocurrency
   */
  async sendCrypto(userId, toAddress, amount, currency = 'ETH') {
    try {
      if (!this.initialized) {
        throw new Error('CDP not initialized');
      }

      console.log(`💸 Sending ${amount} ${currency} from user ${userId} to ${toAddress}`);

      const { address: fromAddress, network } = await this.getWallet(userId);
      
      // Create transaction record
      const transaction = await this.prisma.transaction.create({
        data: {
          userId,
          type: 'SEND',
          status: 'PROCESSING',
          amount: parseFloat(amount),
          currency: currency.toUpperCase(),
          description: `Send ${amount} ${currency} to ${toAddress}`,
          toAddress,
          fromAddress,
        },
      });

      try {
        // Send transaction using CDP
        const txResult = await this.cdp.evm.sendTransaction({
          address: fromAddress,
          network: network,
          transaction: {
            to: toAddress,
            value: currency.toUpperCase() === 'ETH' ? amount : '0',
            data: '0x',
          },
        });

        const txHash = txResult.transactionHash;
        
        // Update transaction record
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            txHash: txHash,
            status: 'PENDING',
          },
        });

        console.log(`✅ Transaction sent: ${txHash}`);
        
        return {
          success: true,
          transactionId: transaction.id,
          transactionHash: txHash,
          amount,
          currency,
          toAddress,
        };
      } catch (sendError) {
        // Update transaction as failed
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
        
        throw sendError;
      }
    } catch (error) {
      console.error(`❌ Error sending crypto for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Request testnet tokens
   */
  async requestTestnetTokens(userId) {
    try {
      if (!this.initialized) {
        throw new Error('CDP not initialized');
      }

      const { address, network } = await this.getWallet(userId);
      
      // Request faucet funds
      const faucetResult = await this.cdp.evm.requestFaucet({
        address: address,
        network: network,
        token: 'eth',
      });
      
      console.log(`🚰 Faucet requested for user ${userId}: ${faucetResult.transactionHash}`);
      
      return {
        success: true,
        transactionHash: faucetResult.transactionHash,
        amount: '0.1',
        currency: 'ETH',
      };
    } catch (error) {
      console.error(`❌ Error requesting testnet tokens for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(userId, limit = 20) {
    try {
      const transactions = await this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return transactions;
    } catch (error) {
      console.error(`❌ Error getting transaction history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get wallet analytics
   */
  async getWalletAnalytics(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          transactions: {
            where: { status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const balance = user.walletAddress ? await this.getWalletBalance(userId) : { ETH: '0', USD: '0' };
      
      // Calculate stats
      const stats = {
        totalSent: 0,
        totalReceived: 0,
        totalTransactions: 0,
      };

      for (const tx of user.transactions) {
        stats.totalTransactions++;
        if (tx.type === 'SEND') {
          stats.totalSent += parseFloat(tx.amount);
        } else if (tx.type === 'RECEIVE') {
          stats.totalReceived += parseFloat(tx.amount);
        }
      }

      return {
        walletAddress: user.walletAddress,
        walletNetwork: user.walletNetwork,
        balance,
        stats,
        recentTransactions: user.transactions,
      };
    } catch (error) {
      console.error(`❌ Error getting wallet analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has wallet
   */
  async hasWallet(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });

      return !!(user?.walletAddress);
    } catch (error) {
      console.error(`❌ Error checking wallet for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Validate wallet address
   */
  validateAddress(address) {
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethRegex.test(address);
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks() {
    return [
      { id: 'base-sepolia', name: 'Base Sepolia (Testnet)', isTestnet: true },
      { id: 'base-mainnet', name: 'Base Mainnet', isTestnet: false },
      { id: 'ethereum-sepolia', name: 'Ethereum Sepolia (Testnet)', isTestnet: true },
      { id: 'ethereum-mainnet', name: 'Ethereum Mainnet', isTestnet: false },
    ];
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      sdk: 'CDP SDK',
      remoteKeyManagement: true,
    };
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}

export default WalletService; 