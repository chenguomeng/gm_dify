import type { NextConfig } from '@/next'
import createMDX from '@next/mdx'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { env } from './env'

const isDev = process.env.NODE_ENV === 'development'
const withMDX = createMDX()
const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const enableCodeInspector = !process.env.DISABLE_CODE_INSPECTOR && isDev

// 低内存模式：内存较小的开发机（<= 16G）可设 LOW_MEMORY_DEV=1 降低 dev server 内存占用。
const lowMemoryDev = isDev && process.env.LOW_MEMORY_DEV === '1'

// Turbopack 的内存目标（字节）。默认让它在超过该水位时更积极地回收，
// 避免 Node 侧 "Fatal process out of memory: Zone" 直接崩掉进程。
const turbopackMemoryLimit =
  Number(process.env.TURBOPACK_MEMORY_LIMIT_MB || 0) > 0
    ? Number(process.env.TURBOPACK_MEMORY_LIMIT_MB) * 1024 * 1024
    : lowMemoryDev
      ? 3 * 1024 * 1024 * 1024
      : undefined

const nextConfig: NextConfig = {
  basePath: env.NEXT_PUBLIC_BASE_PATH,
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  transpilePackages: ['@t3-oss/env-core', '@t3-oss/env-nextjs', 'echarts', 'zrender'],
  serverExternalPackages: ['loro-crdt'],
  turbopack: {
    ...(enableCodeInspector
      ? {
          rules: codeInspectorPlugin({
            bundler: 'turbopack',
          }),
        }
      : {}),
  },
  experimental: {
    ...(turbopackMemoryLimit ? { turbopackMemoryLimit } : {}),
    // 启动时不预编译全部路由入口，只编译访问到的页面（117 个 page 全预热很吃内存）
    ...(lowMemoryDev
      ? {
          preloadEntriesOnStart: false,
          // dev source map 是内存大户，低内存模式下关掉浏览器端 source map
          turbopackSourceMaps: false,
        }
      : {}),
  },
  ...(lowMemoryDev
    ? {
        // 更快回收不活跃页面的编译产物：默认 60s / 5 页
        onDemandEntries: {
          maxInactiveAge: 25 * 1000,
          pagesBufferLength: 2,
        },
        // 浏览器 console 全量转发到终端会持续累积字符串，低内存模式只留 error
        logging: {
          browserToTerminal: 'error' as const,
          incomingRequests: false,
        },
      }
    : {}),
  productionBrowserSourceMaps: false, // enable browser source map generation during the production build
  // Configure pageExtensions to include md and mdx
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  typescript: {
    // https://nextjs.org/docs/api-reference/next.config.js/ignoring-typescript-errors
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/explore/apps',
        destination: '/',
        permanent: false,
      },
    ]
  },
  // Deny framing on device-flow routes — no trusted embedder exists.
  async headers() {
    const antiFrame = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]
    return [
      { source: '/device', headers: antiFrame },
      { source: '/device/:path*', headers: antiFrame },
    ]
  },
  output: 'standalone',
  compiler: {
    removeConsole: isDev ? false : { exclude: ['warn', 'error'] },
  },
}

export default withMDX(nextConfig)
