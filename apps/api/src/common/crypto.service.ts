import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Cryptographic primitives:
 *  - scrypt password hashing (memory-hard, per-hash salt)
 *  - AES-256-GCM field & file encryption (authenticated)
 *  - HMAC-SHA256 blind indexes for searching encrypted fields
 */
@Injectable()
export class CryptoService {
  private readonly key = Buffer.from(env().ENCRYPTION_KEY, 'base64');
  private readonly hmacKey = env().HMAC_KEY;

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scryptAsync(password.normalize('NFKC'), salt, 64, SCRYPT);
    return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [algo, n, saltB64, hashB64] = stored.split('$');
    if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scryptAsync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { ...SCRYPT, N: Number(n) });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  encrypt(plain: string): string {
    return this.encryptBuffer(Buffer.from(plain, 'utf8')).toString('base64');
  }

  decrypt(payload: string): string {
    return this.decryptBuffer(Buffer.from(payload, 'base64')).toString('utf8');
  }

  /** Layout: [12-byte IV][16-byte tag][ciphertext] */
  encryptBuffer(plain: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]);
  }

  decryptBuffer(payload: Buffer): Buffer {
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
  }

  blindIndex(value: string): string {
    return createHmac('sha256', this.hmacKey).update(value.trim().toUpperCase()).digest('hex');
  }

  sha256(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  hmac(secret: string, data: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  token(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  otp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Human-friendly reference numbers, e.g. APP-261118-7K3Q9P (unambiguous alphabet). */
  reference(prefix: string): string {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const d = new Date();
    const date = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    let rand = '';
    for (let i = 0; i < 6; i++) rand += alphabet[randomInt(0, alphabet.length)];
    return `${prefix}-${date}-${rand}`;
  }
}
