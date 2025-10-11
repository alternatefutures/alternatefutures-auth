/**
 * Sign-In with Ethereum (SIWE) service
 * Implements EIP-4361: Sign-In with Ethereum
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface SIWEMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export class SIWEService {
  /**
   * Create a SIWE message string (EIP-4361 format)
   */
  createMessage(params: SIWEMessage): string {
    const {
      domain,
      address,
      statement,
      uri,
      version,
      chainId,
      nonce,
      issuedAt,
      expirationTime,
      notBefore,
      requestId,
      resources,
    } = params;

    let message = `${domain} wants you to sign in with your Ethereum account:\n`;
    message += `${address}\n\n`;

    if (statement) {
      message += `${statement}\n\n`;
    }

    message += `URI: ${uri}\n`;
    message += `Version: ${version}\n`;
    message += `Chain ID: ${chainId}\n`;
    message += `Nonce: ${nonce}\n`;
    message += `Issued At: ${issuedAt}`;

    if (expirationTime) {
      message += `\nExpiration Time: ${expirationTime}`;
    }

    if (notBefore) {
      message += `\nNot Before: ${notBefore}`;
    }

    if (requestId) {
      message += `\nRequest ID: ${requestId}`;
    }

    if (resources && resources.length > 0) {
      message += `\nResources:`;
      resources.forEach((resource) => {
        message += `\n- ${resource}`;
      });
    }

    return message;
  }

  /**
   * Verify an Ethereum signature
   */
  verifySignature(message: string, signature: string, address: string): boolean {
    try {
      // Ethereum uses "\x19Ethereum Signed Message:\n" prefix
      const prefix = '\x19Ethereum Signed Message:\n';
      const prefixedMessage = prefix + message.length + message;

      // Hash the prefixed message
      const messageHash = keccak_256(new TextEncoder().encode(prefixedMessage));

      // Parse signature (remove 0x prefix if present)
      const sig = signature.startsWith('0x') ? signature.slice(2) : signature;

      // Extract r, s, v from signature
      const r = sig.slice(0, 64);
      const s = sig.slice(64, 128);
      const v = parseInt(sig.slice(128, 130), 16);

      // Recover public key from signature
      const recovery = v - 27;
      if (recovery !== 0 && recovery !== 1) {
        return false;
      }

      const publicKey = secp256k1.Signature.fromCompact(r + s)
        .addRecoveryBit(recovery)
        .recoverPublicKey(messageHash)
        .toRawBytes(false); // uncompressed

      // Derive Ethereum address from public key
      const publicKeyHash = keccak_256(publicKey.slice(1)); // Remove 0x04 prefix
      const derivedAddress = '0x' + bytesToHex(publicKeyHash.slice(-20));

      // Compare addresses (case-insensitive)
      return derivedAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify a Solana signature
   */
  verifySolanaSignature(message: string, signature: string, publicKey: string): boolean {
    // TODO: Implement Solana signature verification using ed25519
    // For MVP, we'll return false and implement this later
    console.warn('Solana signature verification not yet implemented');
    return false;
  }
}

export const siweService = new SIWEService();
