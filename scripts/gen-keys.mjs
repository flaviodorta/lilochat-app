#!/usr/bin/env node
// Generates the RS256 keypair for JWT signing (CLAUDE.md §9.2).
// Prints base64-encoded PEMs ready to paste into .env files — never commit them.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

console.log('# identity service (signs tokens):');
console.log(`JWT_PRIVATE_KEY=${Buffer.from(privateKey).toString('base64')}`);
console.log('\n# gateway & friends (verify tokens):');
console.log(`JWT_PUBLIC_KEY=${Buffer.from(publicKey).toString('base64')}`);
