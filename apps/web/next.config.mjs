/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dsk/shared", "@dsk/i18n", "@dsk/db", "@dsk/integrations"],
  experimental: {},
};

export default nextConfig;
