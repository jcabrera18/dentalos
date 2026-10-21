import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shaking más agresivo para librerías con muchos named exports:
  // importa solo los símbolos usados (iconos, piezas de gráficos) en vez del barrel entero.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  // En producción saca los console.* (dejamos error/warn) para no enviar logs al cliente.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
};

export default nextConfig;
