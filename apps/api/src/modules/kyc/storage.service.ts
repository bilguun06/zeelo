import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { env } from '../../config/env';
import { CryptoService } from '../../common/crypto.service';

const SIGNATURES: { mime: string; magic: number[] }[] = [
  { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
];

/**
 * Encrypted-at-rest document storage. Files are AES-256-GCM encrypted before touching disk and
 * stored under random keys (no user-controlled paths). Swap for S3/MinIO with SSE-KMS in production
 * by keeping the same interface.
 */
@Injectable()
export class StorageService {
  private readonly root = resolve(env().UPLOAD_DIR);
  constructor(private readonly crypto: CryptoService) {}

  /** Detects type from magic bytes — the client-declared MIME type is ignored. */
  sniff(buf: Buffer): string {
    const hit = SIGNATURES.find((s) => s.magic.every((b, i) => buf[i] === b));
    if (!hit) throw new BadRequestException({ message: 'Only JPEG, PNG or PDF files are accepted', code: 'FILE_TYPE' });
    return hit.mime;
  }

  async put(buf: Buffer): Promise<{ key: string; mime: string; sha256: string; size: number }> {
    const max = env().MAX_UPLOAD_MB * 1024 * 1024;
    if (buf.length === 0 || buf.length > max) throw new BadRequestException({ message: `File must be 1B–${env().MAX_UPLOAD_MB}MB`, code: 'FILE_SIZE' });
    const mime = this.sniff(buf);
    const key = `${new Date().toISOString().slice(0, 7)}/${this.crypto.token(18)}.bin`;
    const path = join(this.root, key);
    await mkdir(join(this.root, key.split('/')[0]), { recursive: true });
    await writeFile(path, this.crypto.encryptBuffer(buf), { mode: 0o600 });
    return { key, mime, sha256: this.crypto.sha256(buf), size: buf.length };
  }

  async get(key: string): Promise<Buffer> {
    if (!/^\d{4}-\d{2}\/[\w-]+\.bin$/.test(key)) throw new BadRequestException('Invalid key');
    return this.crypto.decryptBuffer(await readFile(join(this.root, key)));
  }
}
