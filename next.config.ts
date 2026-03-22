import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: configDir,
  },
  // Evita que Next empaquete módulos server-only o nativos en los chunks del servidor.
  serverExternalPackages: ['pdf-parse', 'pdf2json', '@napi-rs/canvas', 'nodemailer'],
};

export default nextConfig;
