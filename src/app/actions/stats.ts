'use server'

import { db } from '@/db'
import { identities, clusters, faces, cameras, recognitionLogs } from '@/db/schema'
import { sql, eq, gte, and } from 'drizzle-orm'

export interface DashboardStats {
  identitiesCount: number
  pendingClustersCount: number
  todayRecognitionsCount: number
  onlineCamerasCount: number
  totalFacesCount: number
  unclusteredFacesCount: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    identitiesResult,
    pendingClustersResult,
    todayRecognitionsResult,
    onlineCamerasResult,
    facesResult,
  ] = await Promise.all([
    // 已识别身份数
    db.select({ count: sql<number>`count(*)` }).from(identities),
    
    // 待标注聚类数
    db.select({ count: sql<number>`count(*)` })
      .from(clusters)
      .where(eq(clusters.status, 'pending')),
    
    // 今日识别次数
    db.select({ count: sql<number>`count(*)` })
      .from(recognitionLogs)
      .where(gte(recognitionLogs.timestamp, today)),
    
    // 在线摄像头数
    db.select({ count: sql<number>`count(*)` })
      .from(cameras)
      .where(eq(cameras.status, 'online')),
    
    // 人脸统计
    db.select({
      total: sql<number>`count(*)`,
      unclustered: sql<number>`count(*) filter (where ${faces.clusterId} is null)`,
    }).from(faces),
  ])

  return {
    identitiesCount: Number(identitiesResult[0]?.count ?? 0),
    pendingClustersCount: Number(pendingClustersResult[0]?.count ?? 0),
    todayRecognitionsCount: Number(todayRecognitionsResult[0]?.count ?? 0),
    onlineCamerasCount: Number(onlineCamerasResult[0]?.count ?? 0),
    totalFacesCount: Number(facesResult[0]?.total ?? 0),
    unclusteredFacesCount: Number(facesResult[0]?.unclustered ?? 0),
  }
}

export interface RecentActivity {
  id: string
  type: 'recognition' | 'cluster' | 'identity'
  title: string
  description: string
  timestamp: Date
}

export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  // 获取最近的识别记录
  const recentRecognitions = await db.query.recognitionLogs.findMany({
    limit,
    orderBy: (logs, { desc }) => [desc(logs.timestamp)],
    with: {
      identity: true,
    },
  })

  return recentRecognitions.map((log) => ({
    id: log.id,
    type: 'recognition' as const,
    title: log.isStranger ? '陌生人识别' : `识别: ${log.identity?.name ?? '未知'}`,
    description: log.confidence 
      ? `置信度 ${(log.confidence * 100).toFixed(1)}%`
      : '',
    timestamp: log.timestamp ?? new Date(),
  }))
}

export interface HourlyStats {
  hour: number
  count: number
  identified: number
  strangers: number
}

/**
 * 获取过去 24 小时的识别统计（按小时分组）
 */
export async function getHourlyRecognitionStats(): Promise<HourlyStats[]> {
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const logs = await db.query.recognitionLogs.findMany({
    where: gte(recognitionLogs.timestamp, since),
  })

  // 按小时分组
  const hourlyMap = new Map<number, { count: number; identified: number; strangers: number }>()

  // 初始化 24 小时
  for (let i = 0; i < 24; i++) {
    const hour = (now.getHours() - 23 + i + 24) % 24
    hourlyMap.set(hour, { count: 0, identified: 0, strangers: 0 })
  }

  // 统计
  for (const log of logs) {
    if (log.timestamp) {
      const hour = new Date(log.timestamp).getHours()
      const stats = hourlyMap.get(hour)
      if (stats) {
        stats.count++
        if (log.isStranger) {
          stats.strangers++
        } else {
          stats.identified++
        }
      }
    }
  }

  // 转换为数组
  return Array.from(hourlyMap.entries())
    .sort((a, b) => {
      const aOrder = (a[0] - now.getHours() + 24) % 24
      const bOrder = (b[0] - now.getHours() + 24) % 24
      return aOrder - bOrder
    })
    .map(([hour, data]) => ({
      hour,
      ...data,
    }))
}

export interface TopIdentity {
  id: string
  name: string
  avatarPath: string | null
  recognitionCount: number
  lastSeen: Date | null
}

/**
 * 获取识别次数最多的身份
 */
export async function getTopIdentities(limit: number = 5): Promise<TopIdentity[]> {
  const logs = await db.query.recognitionLogs.findMany({
    where: eq(recognitionLogs.isStranger, false),
    with: {
      identity: true,
    },
  })

  // 按身份分组统计
  const identityMap = new Map<string, {
    identity: typeof logs[0]['identity']
    count: number
    lastSeen: Date | null
  }>()

  for (const log of logs) {
    if (log.identity) {
      const existing = identityMap.get(log.identity.id)
      if (existing) {
        existing.count++
        if (log.timestamp && (!existing.lastSeen || log.timestamp > existing.lastSeen)) {
          existing.lastSeen = log.timestamp
        }
      } else {
        identityMap.set(log.identity.id, {
          identity: log.identity,
          count: 1,
          lastSeen: log.timestamp,
        })
      }
    }
  }

  // 排序并取前 N
  return Array.from(identityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({
      id: item.identity!.id,
      name: item.identity!.name,
      avatarPath: item.identity!.avatarPath,
      recognitionCount: item.count,
      lastSeen: item.lastSeen,
    }))
}
