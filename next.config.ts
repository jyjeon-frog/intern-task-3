import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() 을 써서 권한 없는 접근에 실제 HTTP 403을 내려주기 위해 필요
    authInterrupts: true,
  },
};

export default nextConfig;
