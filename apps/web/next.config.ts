import type { NextConfig } from "next";

/**
 * Security headers (implementation/SECURITY_AUDIT_CHECKLIST.md NX-04).
 *
 * The enforced CSP carries only directives that cannot break a same-origin
 * page: the homepage demo and /dev/study frame same-origin documents, so
 * framing is limited to 'self' rather than 'none'. The full policy ships as
 * Report-Only until a browser pass confirms every origin it needs.
 */
const enforcedCsp = ["frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'"].join("; ");

const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://formsubmit.co",
  "form-action 'self' https://*.supabase.co https://accounts.google.com https://formsubmit.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
];

const nextConfig: NextConfig = {
  transpilePackages: ["@studigo/ai", "@studigo/documents", "@studigo/learning"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  }
};

export default nextConfig;
