/** Loads apps/api/.env (if present) before any module reads configuration. Must be the first import. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(__dirname, '..', '.env');
if (existsSync(file)) process.loadEnvFile(file);
