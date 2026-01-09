import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// 获取连接字符串并移除不支持的参数（如 Prisma 的 ?schema=xxx）
function getConnectionString(): string {
  const url = process.env.DATABASE_URL!
  try {
    const parsedUrl = new URL(url)
    // 移除 PostgreSQL 不支持的参数
    parsedUrl.searchParams.delete('schema')
    return parsedUrl.toString()
  } catch {
    // 如果 URL 解析失败，返回原始字符串
    return url
  }
}

const connectionString = getConnectionString()

// 用于查询的连接
const client = postgres(connectionString)

export const db = drizzle(client, { schema })

// 导出 schema 供其他模块使用
export { schema }
