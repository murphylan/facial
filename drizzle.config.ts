import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// 加载 .env.local (Next.js 风格)
config({ path: '.env.local' })

// 获取连接字符串并移除不支持的参数
function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Please check your .env.local file.')
  }
  try {
    const parsedUrl = new URL(url)
    parsedUrl.searchParams.delete('schema')
    return parsedUrl.toString()
  } catch {
    return url
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getConnectionString(),
  },
  // 只管理 facial schema，不影响其他 schema 的表
  schemaFilter: ['facial'],
  // 使用严格模式，只处理定义的表
  strict: true,
})
