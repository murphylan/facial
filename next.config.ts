import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 配置 webpack 排除 @vladmandic/human 的 Node.js 版本
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 服务端：将 @vladmandic/human 标记为外部模块
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@vladmandic/human');
      }
    }

    // 添加 fallback 配置
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },

  // Turbopack 配置（空配置消除警告）
  turbopack: {
    resolveAlias: {
      // 使用浏览器版本的 human
      '@vladmandic/human': '@vladmandic/human/dist/human.esm.js',
    },
  },

  // 服务端外部化包
  serverExternalPackages: ['@vladmandic/human', '@tensorflow/tfjs-node'],
};

export default nextConfig;
