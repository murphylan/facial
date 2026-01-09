'use server'

import { db } from '@/db'
import { faces, images, clusters } from '@/db/schema'
import { eq, sql, isNull, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getFaces(options?: {
  clusterId?: string
  imageId?: string
  unclustered?: boolean
  limit?: number
  offset?: number
}) {
  const { clusterId, imageId, unclustered, limit = 50, offset = 0 } = options ?? {}

  return await db.query.faces.findMany({
    where: (faces, { eq, isNull, and }) => {
      const conditions = []
      if (clusterId) conditions.push(eq(faces.clusterId, clusterId))
      if (imageId) conditions.push(eq(faces.imageId, imageId))
      if (unclustered) conditions.push(isNull(faces.clusterId))
      return conditions.length > 0 ? and(...conditions) : undefined
    },
    limit,
    offset,
    orderBy: (faces, { desc }) => [desc(faces.createdAt)],
    with: {
      image: true,
      cluster: true,
    },
  })
}

export async function getFaceById(id: string) {
  return await db.query.faces.findFirst({
    where: eq(faces.id, id),
    with: {
      image: true,
      cluster: {
        with: {
          identityClusters: {
            with: {
              identity: true,
            },
          },
        },
      },
    },
  })
}

export async function getUnclusteredFaces() {
  return await getFaces({ unclustered: true })
}

export async function getFaceStats() {
  const result = await db
    .select({
      total: sql<number>`count(*)`,
      clustered: sql<number>`count(${faces.clusterId})`,
      unclustered: sql<number>`count(*) filter (where ${faces.clusterId} is null)`,
    })
    .from(faces)

  return result[0]
}

// ============================================
// 变更操作 - 供 useMutation 使用
// ============================================

export interface CreateFaceInput {
  imageId: string
  bbox: { x: number; y: number; width: number; height: number }
  embedding?: number[]
  thumbnailPath?: string
  qualityScore?: number
  age?: number
  gender?: 'male' | 'female' | 'unknown'
  emotion?: string
}

export async function createFace(data: CreateFaceInput) {
  const result = await db
    .insert(faces)
    .values({
      id: generateId(),
      imageId: data.imageId,
      bbox: data.bbox,
      embedding: data.embedding,
      thumbnailPath: data.thumbnailPath,
      qualityScore: data.qualityScore,
      age: data.age,
      gender: data.gender,
      emotion: data.emotion,
    })
    .returning()

  revalidatePath('/clusters')
  return result[0]
}

export async function createFaces(dataList: CreateFaceInput[]) {
  if (dataList.length === 0) return []

  const result = await db
    .insert(faces)
    .values(
      dataList.map((data) => ({
        id: generateId(),
        imageId: data.imageId,
        bbox: data.bbox,
        embedding: data.embedding,
        thumbnailPath: data.thumbnailPath,
        qualityScore: data.qualityScore,
        age: data.age,
        gender: data.gender,
        emotion: data.emotion,
      }))
    )
    .returning()

  revalidatePath('/clusters')
  return result
}

export async function updateFaceCluster(faceId: string, clusterId: string | null) {
  const result = await db
    .update(faces)
    .set({ clusterId })
    .where(eq(faces.id, faceId))
    .returning()

  // 更新聚类的人脸计数
  if (clusterId) {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(faces)
      .where(eq(faces.clusterId, clusterId))

    await db
      .update(clusters)
      .set({ faceCount: count[0].count })
      .where(eq(clusters.id, clusterId))
  }

  revalidatePath('/clusters')
  return result[0]
}

export async function moveFacesToCluster(faceIds: string[], targetClusterId: string) {
  // 获取原来的 clusterIds
  const originalFaces = await db.query.faces.findMany({
    where: inArray(faces.id, faceIds),
  })
  const originalClusterIds = [...new Set(originalFaces.map((f) => f.clusterId).filter(Boolean))]

  // 移动人脸
  await db
    .update(faces)
    .set({ clusterId: targetClusterId })
    .where(inArray(faces.id, faceIds))

  // 更新目标聚类的计数
  const targetCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(faces)
    .where(eq(faces.clusterId, targetClusterId))

  await db
    .update(clusters)
    .set({ faceCount: targetCount[0].count })
    .where(eq(clusters.id, targetClusterId))

  // 更新原聚类的计数
  for (const clusterId of originalClusterIds) {
    if (clusterId) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(faces)
        .where(eq(faces.clusterId, clusterId))

      await db
        .update(clusters)
        .set({ faceCount: count[0].count })
        .where(eq(clusters.id, clusterId))
    }
  }

  revalidatePath('/clusters')
  revalidatePath('/annotate')
}

export async function deleteFace(id: string) {
  const face = await db.query.faces.findFirst({
    where: eq(faces.id, id),
  })

  await db.delete(faces).where(eq(faces.id, id))

  // 更新聚类计数
  if (face?.clusterId) {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(faces)
      .where(eq(faces.clusterId, face.clusterId))

    await db
      .update(clusters)
      .set({ faceCount: count[0].count })
      .where(eq(clusters.id, face.clusterId))
  }

  revalidatePath('/clusters')
}
