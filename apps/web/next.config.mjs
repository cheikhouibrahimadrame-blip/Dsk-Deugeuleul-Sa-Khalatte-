/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dsk/shared", "@dsk/i18n", "@dsk/db", "@dsk/integrations"],
  allowedDevOrigins: ["http://192.168.1.12:3000"],
  experimental: {},
};

export default nextConfig;
