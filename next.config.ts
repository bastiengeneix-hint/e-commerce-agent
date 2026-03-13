import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Skip env validation during build (validated at runtime)
  env: {
    SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION ?? "",
  },
  // Allow Google profile images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
