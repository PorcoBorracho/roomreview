import type { NextConfig } from "next";

const securityHeaders = [
  // La Content-Security-Policy (con nonce por petición) la pone src/proxy.ts
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Páginas privadas: nunca en caché ni en buscadores
      ...[
        "/login", "/setup", "/panel", "/streamers", "/team", "/admins", "/problems", "/audit",
        "/account", "/account/password", "/account/2fa", "/:streamer/:board/queue", "/:streamer/:board/deck",
      ].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "100kb" },
  },
};

export default nextConfig;
