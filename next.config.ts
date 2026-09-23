import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Practical CSP for Rental OS CRM.
 * - next/font self-hosts Geist → no Google Fonts CDN required
 * - 'unsafe-inline' on style-src: required for Next/Tailwind inline style attributes
 * - 'unsafe-inline' on script-src in production without nonces: Next.js App Router
 *   still emits inline bootstrapping in some paths; documented exception
 * - 'unsafe-eval' only in development (Next/Turbopack HMR)
 */
function contentSecurityPolicy(): string {
  const scriptSrc = isProd
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "argon2", "sharp"],
  // proxy.ts buffers request bodies (default 10MB). Photo uploads need headroom for
  // multipart overhead around a 10MB original; multi-file posts go higher.
  experimental: {
    proxyClientMaxBodySize: "32mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
