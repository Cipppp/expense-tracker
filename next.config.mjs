/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fontul facturilor noi se citeste de pe disc la randare; fara asta nu
  // ajunge in functiile de pe Vercel.
  outputFileTracingIncludes: {
    "/api/invoices/**/*": ["./src/assets/fonts/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
