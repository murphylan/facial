'use server'

import { db } from '@/db'
import { recognitionLogs, faces, identities, identityClusters, clusters } from '@/db/schema'
import { eq, desc, sql, gte, lt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { cosineSimilarity } from '@/lib/embedding'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getRecognitionLogs(options?: {
  cameraId?: string
  identityId?: string
  isStranger?: boolean
  limit?: number
  offset?: number
  since?: Date
}) {
  const { cameraId, identityId, isStranger, limit = 50, offset = 0, since } = options ?? {}

  return await db.query.recognitionLogs.findMany({
    where: (logs, { eq, and, gte }) => {
      const conditions = []
      if (cameraId) conditions.push(eq(logs.cameraId, cameraId))
      if (identityId) conditions.push(eq(logs.matchedIdentityId, identityId))
      if (isStranger !== undefined) conditions.push(eq(logs.isStranger, isStranger))
      if (since) conditions.push(gte(logs.timestamp, since))
      return conditions.length > 0 ? and(...conditions) : undefined
    },
    limit,
    offset,
    orderBy: (logs, { desc }) => [desc(logs.timestamp)],
    with: {
      identity: true,
      camera: true,
      face: true,
    },
  })
}

export async function getRecentRecognitions(minutes: number = 60) {
  const since = new Date(Date.now() - minutes * 60 * 1000)
  return await getRecognitionLogs({ since, limit: 100 })
}

export async function getRecognitionStats(options?: { since?: Date }) {
  const { since } = options ?? {}

  const baseWhere = since ? gte(recognitionLogs.timestamp, since) : undefined

  const result = await db
    .select({
      total: sql<number>`count(*)`,
      identified: sql<number>`count(*) filter (where ${recognitionLogs.isStranger} = false)`,
      strangers: sql<number>`count(*) filter (where ${recognitionLogs.isStranger} = true)`,
    })
    .from(recognitionLogs)
    .where(baseWhere)

  return result[0]
}

// ============================================
// 识别操作 - 供 useMutation 使用
// ============================================

export interface RecognizeInput {
  embedding: number[]
  cameraId?: string
  thumbnailPath?: string
  faceId?: string
}

export async function recognizeFace(input: RecognizeInput) {
  const { embedding, cameraId, thumbnailPath, faceId } = input

  // 获取所有已标注身份的聚类中心
  const identitiesWithClusters = await db.query.identities.findMany({
    with: {
      identityClusters: {
        with: {
          cluster: true,
        },
      },
    },
  })

  // 查找最佳匹配
  let bestMatch: {
    identity: typeof identitiesWithClusters[0]
    similarity: number
  } | null = null

  const threshold = 0.6 // 识别阈值

  for (const identity of identitiesWithClusters) {
    for (const ic of identity.identityClusters) {
      if (ic.cluster?.centroid) {
        const similarity = cosineSimilarity(
          embedding,
          ic.cluster.centroid as number[]
        )
        if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { identity, similarity }
        }
      }
    }
  }

  // 创建识别记录
  const logId = generateId()
  const isStranger = !bestMatch

  await db.insert(recognitionLogs).values({
    id: logId,
    faceId,
    matchedIdentityId: bestMatch?.identity.id ?? null,
    confidence: bestMatch?.similarity ?? null,
    cameraId,
    isStranger,
    thumbnailPath,
  })

  revalidatePath('/recognition')

  return {
    logId,
    isStranger,
    identity: bestMatch?.identity ?? null,
    confidence: bestMatch?.similarity ?? null,
  }
}

export async function deleteRecognitionLog(id: string) {
  await db.delete(recognitionLogs).where(eq(recognitionLogs.id, id))
  revalidatePath('/recognition')
}

export async function clearOldLogs(daysToKeep: number = 30) {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  
  const result = await db
    .delete(recognitionLogs)
    .where(lt(recognitionLogs.timestamp, cutoff))

  revalidatePath('/recognition')
  return result
}

/**
 * 清空所有识别记录
 */
export async function clearAllLogs() {
  await db.delete(recognitionLogs)
  revalidatePath('/recognition')
}
