import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que Next empaquete estos módulos nativos en los chunks del servidor.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
};

export default nextConfig;
