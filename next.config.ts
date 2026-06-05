import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  serverExternalPackages: ["ffmpeg-static"],
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/workspace",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
