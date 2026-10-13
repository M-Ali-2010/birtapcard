import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Презентация для клиентов лежит в public/info.html,
    // но открывается по короткому адресу /info
    return [
      { source: "/info", destination: "/info.html" },
      // Персональное предложение для PDP School
      { source: "/pdp", destination: "/pdp.html" },
      // Макет экрана ссылок под дизайн PDP University — для показа
      { source: "/pdp/university", destination: "/pdp/university.html" },
    ];
  },
};

export default nextConfig;
