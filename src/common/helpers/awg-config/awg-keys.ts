import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';

// PKCS#8 DER prefix for a raw 32-byte X25519 private key
const X25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');

const publicKeyCache = new Map<string, string>();

export interface IAwgKeyPair {
    privateKey: string;
    publicKey: string;
}

export function generateAwgKeyPair(): IAwgKeyPair {
    const { privateKey, publicKey } = generateKeyPairSync('x25519');

    const rawPrivate = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
    const rawPublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);

    return {
        privateKey: rawPrivate.toString('base64'),
        publicKey: rawPublic.toString('base64'),
    };
}

export function generateAwgPresharedKey(): string {
    return randomBytes(32).toString('base64');
}

export function deriveAwgPublicKey(privateKeyBase64: string): string {
    const cached = publicKeyCache.get(privateKeyBase64);
    if (cached) return cached;

    const raw = Buffer.from(privateKeyBase64, 'base64');

    if (raw.length !== 32) {
        throw new Error('AmneziaWG private key must be a base64 encoded 32-byte key');
    }

    const keyObject = createPrivateKey({
        key: Buffer.concat([X25519_PKCS8_PREFIX, raw]),
        format: 'der',
        type: 'pkcs8',
    });

    const publicKey = createPublicKey(keyObject)
        .export({ format: 'der', type: 'spki' })
        .subarray(-32)
        .toString('base64');

    publicKeyCache.set(privateKeyBase64, publicKey);

    return publicKey;
}
