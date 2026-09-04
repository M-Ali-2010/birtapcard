import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Презентация для клиентов лежит в public/info.html,
    // но открывается по короткому адресу /info
    return [{ source: "/info", destination: "/info.html" }];
  },
};

export default nextConfig;
