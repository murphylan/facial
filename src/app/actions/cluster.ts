'use server'

import { db } from '@/db'
import { clusters, faces } from '@/db/schema'
import { eq, sql, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { meanVector } from '@/lib/embedding'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getClusters(status?: 'pending' | 'confirmed' | 'merged') {
  return await db.query.clusters.findMany({
    where: status ? eq(clusters.status, status) : undefined,
    orderBy: (clusters, { desc }) => [desc(clusters.createdAt)],
    with: {
      faces: {
        limit: 4, // 预览只取 4 张
      },
    },
  })
}

export async function getClusterById(id: string) {
  return await db.query.clusters.findFirst({
    where: eq(clusters.id, id),
    with: {
      faces: {
        with: {
          image: true,
        },
      },
      identityClusters: {
        with: {
          identity: true,
        },
      },
    },
  })
}

export async function getPendingClusters() {
  return await getClusters('pending')
}

export async function getClusterStats() {
  const result = await db
    .select({
      status: clusters.status,
      count: sql<number>`count(*)`,
    })
    .from(clusters)
    .groupBy(clusters.status)

  return {
    pending: result.find((r) => r.status === 'pending')?.count ?? 0,
    confirmed: result.find((r) => r.status === 'confirmed')?.count ?? 0,
    merged: result.find((r) => r.status === 'merged')?.count ?? 0,
    total: result.reduce((sum, r) => sum + Number(r.count), 0),
  }
}

// ============================================
// 变更操作 - 供 useMutation 使用
// ============================================

export interface CreateClusterInput {
  faceIds: string[]
  status?: 'pending' | 'confirmed' | 'merged'
}

export async function createCluster(data: CreateClusterInput) {
  const clusterId = generateId()

  // 获取人脸的 embedding 来计算中心点
  const faceList = await db.query.faces.findMany({
    where: inArray(faces.id, data.faceIds),
  })

  const embeddings = faceList
    .map((f) => f.embedding as number[] | null)
    .filter((e): e is number[] => e !== null)

  const centroid = embeddings.length > 0 ? meanVector(embeddings) : null

  // 创建聚类
  const result = await db
    .insert(clusters)
    .values({
      id: clusterId,
      faceCount: data.faceIds.length,
      representativeFaceId: data.faceIds[0],
      centroid,
      status: data.status ?? 'pending',
    })
    .returning()

  // 更新人脸的 clusterId
  if (data.faceIds.length > 0) {
    await db
      .update(faces)
      .set({ clusterId })
      .where(inArray(faces.id, data.faceIds))
  }

  revalidatePath('/clusters')
  return result[0]
}

export async function mergeClusters(clusterIds: string[]) {
  if (clusterIds.length < 2) {
    throw new Error('At least 2 clusters required for merge')
  }

  // 获取所有要合并的聚类
  const clusterList = await db.query.clusters.findMany({
    where: inArray(clusters.id, clusterIds),
    with: {
      faces: true,
    },
  })

  // 收集所有人脸
  const allFaces = clusterList.flatMap((c) => c.faces)
  const allFaceIds = allFaces.map((f) => f.id)

  // 计算新的中心点
  const embeddings = allFaces
    .map((f) => f.embedding as number[] | null)
    .filter((e): e is number[] => e !== null)

  const newCentroid = embeddings.length > 0 ? meanVector(embeddings) : null

  // 创建新聚类
  const newClusterId = generateId()
  await db.insert(clusters).values({
    id: newClusterId,
    faceCount: allFaceIds.length,
    representativeFaceId: allFaceIds[0],
    centroid: newCentroid,
    status: 'pending',
  })

  // 更新人脸关联
  await db
    .update(faces)
    .set({ clusterId: newClusterId })
    .where(inArray(faces.id, allFaceIds))

  // 标记旧聚类为已合并
  await db
    .update(clusters)
    .set({ status: 'merged' })
    .where(inArray(clusters.id, clusterIds))

  revalidatePath('/clusters')
  return { newClusterId, mergedCount: clusterIds.length }
}

export async function splitCluster(clusterId: string, faceGroups: string[][]) {
  if (faceGroups.length < 2) {
    throw new Error('At least 2 groups required for split')
  }

  const newClusterIds: string[] = []

  for (const faceIds of faceGroups) {
    const newCluster = await createCluster({ faceIds })
    newClusterIds.push(newCluster.id)
  }

  // 标记原聚类为已合并（拆分）
  await db
    .update(clusters)
    .set({ status: 'merged' })
    .where(eq(clusters.id, clusterId))

  revalidatePath('/clusters')
  return { newClusterIds }
}

export async function deleteCluster(id: string) {
  // 将人脸的 clusterId 设为 null
  await db.update(faces).set({ clusterId: null }).where(eq(faces.clusterId, id))

  // 删除聚类
  await db.delete(clusters).where(eq(clusters.id, id))

  revalidatePath('/clusters')
}

export async function updateClusterStatus(
  id: string,
  status: 'pending' | 'confirmed' | 'merged'
) {
  const result = await db
    .update(clusters)
    .set({ status })
    .where(eq(clusters.id, id))
    .returning()

  revalidatePath('/clusters')
  return result[0]
}

/**
 * 将人脸移动到另一个聚类
 */
export async function moveFaceToCluster(faceId: string, targetClusterId: string) {
  // 获取人脸当前的聚类
  const face = await db.query.faces.findFirst({
    where: eq(faces.id, faceId),
  })

  if (!face) {
    throw new Error('Face not found')
  }

  const sourceClusterId = face.clusterId

  // 更新人脸的聚类关联
  await db
    .update(faces)
    .set({ clusterId: targetClusterId })
    .where(eq(faces.id, faceId))

  // 更新源聚类的人脸数和中心点
  if (sourceClusterId) {
    await updateClusterStats(sourceClusterId)
  }

  // 更新目标聚类的人脸数和中心点
  await updateClusterStats(targetClusterId)

  revalidatePath('/clusters')
  return { success: true }
}

/**
 * 批量移动人脸到另一个聚类
 */
export async function moveFacesToCluster(faceIds: string[], targetClusterId: string) {
  // 获取人脸当前的聚类 ID 列表
  const faceList = await db.query.faces.findMany({
    where: inArray(faces.id, faceIds),
  })

  const sourceClusterIds = new Set(
    faceList.map((f) => f.clusterId).filter((id): id is string => id !== null)
  )

  // 更新人脸的聚类关联
  await db
    .update(faces)
    .set({ clusterId: targetClusterId })
    .where(inArray(faces.id, faceIds))

  // 更新所有源聚类的统计
  for (const clusterId of sourceClusterIds) {
    await updateClusterStats(clusterId)
  }

  // 更新目标聚类的统计
  await updateClusterStats(targetClusterId)

  revalidatePath('/clusters')
  return { success: true, movedCount: faceIds.length }
}

/**
 * 更新聚类的统计信息（人脸数量和中心点）
 */
async function updateClusterStats(clusterId: string) {
  const clusterFaces = await db.query.faces.findMany({
    where: eq(faces.clusterId, clusterId),
  })

  if (clusterFaces.length === 0) {
    // 如果没有人脸了，删除聚类
    await db.delete(clusters).where(eq(clusters.id, clusterId))
    return
  }

  const embeddings = clusterFaces
    .map((f) => f.embedding as number[] | null)
    .filter((e): e is number[] => e !== null && e.length > 0)

  const newCentroid = embeddings.length > 0 ? meanVector(embeddings) : null

  await db
    .update(clusters)
    .set({
      faceCount: clusterFaces.length,
      centroid: newCentroid,
      representativeFaceId: clusterFaces[0].id,
    })
    .where(eq(clusters.id, clusterId))
}

/**
 * 设置聚类的代表人脸
 */
export async function setRepresentativeFace(clusterId: string, faceId: string) {
  const result = await db
    .update(clusters)
    .set({ representativeFaceId: faceId })
    .where(eq(clusters.id, clusterId))
    .returning()

  revalidatePath('/clusters')
  return result[0]
}

/**
 * 从聚类中移除人脸（变为未聚类状态）
 */
export async function removeFaceFromCluster(faceId: string) {
  const face = await db.query.faces.findFirst({
    where: eq(faces.id, faceId),
  })

  if (!face || !face.clusterId) {
    return { success: false }
  }

  const clusterId = face.clusterId

  // 清除人脸的聚类关联
  await db
    .update(faces)
    .set({ clusterId: null })
    .where(eq(faces.id, faceId))

  // 更新聚类统计
  await updateClusterStats(clusterId)

  revalidatePath('/clusters')
  return { success: true }
}
