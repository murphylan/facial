'use server'

import { db } from '@/db'
import { faces, clusters } from '@/db/schema'
import { eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { cosineSimilarity, meanVector } from '@/lib/embedding'

// ============================================
// 聚类处理 Server Actions
// ============================================

export interface ClusteringResult {
  newClusters: number
  updatedClusters: number
  assignedFaces: number
  unassignedFaces: number
}

/**
 * 对所有未聚类的人脸进行聚类处理
 */
export async function clusterUnassignedFaces(
  threshold: number = 0.5
): Promise<ClusteringResult> {
  // 获取所有未聚类的人脸（需要有 embedding）
  const unclusteredFaces = await db.query.faces.findMany({
    where: isNull(faces.clusterId),
  })

  const facesWithEmbedding = unclusteredFaces.filter(
    (f) => f.embedding && Array.isArray(f.embedding)
  )

  if (facesWithEmbedding.length === 0) {
    return {
      newClusters: 0,
      updatedClusters: 0,
      assignedFaces: 0,
      unassignedFaces: unclusteredFaces.length - facesWithEmbedding.length,
    }
  }

  // 获取所有活跃的聚类（pending 和 confirmed，排除 merged）
  const existingClusters = await db.query.clusters.findMany({
    where: (clusters, { ne }) => ne(clusters.status, 'merged'),
  })

  let newClustersCount = 0
  let updatedClustersCount = 0
  let assignedCount = 0

  // 尝试将每个人脸分配到现有聚类或创建新聚类
  for (const face of facesWithEmbedding) {
    const embedding = face.embedding as number[]

    // 查找最匹配的现有聚类
    let bestMatch: { clusterId: string; similarity: number } | null = null

    for (const cluster of existingClusters) {
      if (cluster.centroid) {
        const similarity = cosineSimilarity(
          embedding,
          cluster.centroid as number[]
        )
        if (similarity >= threshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { clusterId: cluster.id, similarity }
          }
        }
      }
    }

    if (bestMatch) {
      // 分配到现有聚类
      await db
        .update(faces)
        .set({ clusterId: bestMatch.clusterId })
        .where(eq(faces.id, face.id))

      // 更新聚类的人脸计数和中心点
      await updateClusterCentroid(bestMatch.clusterId)
      updatedClustersCount++
      assignedCount++
    } else {
      // 创建新聚类
      const newClusterId = generateId()
      await db.insert(clusters).values({
        id: newClusterId,
        faceCount: 1,
        representativeFaceId: face.id,
        centroid: embedding,
        status: 'pending',
      })

      await db
        .update(faces)
        .set({ clusterId: newClusterId })
        .where(eq(faces.id, face.id))

      // 添加到现有聚类列表以便后续比较
      existingClusters.push({
        id: newClusterId,
        faceCount: 1,
        representativeFaceId: face.id,
        centroid: embedding,
        status: 'pending',
        createdAt: new Date(),
      })

      newClustersCount++
      assignedCount++
    }
  }

  revalidatePath('/clusters')
  revalidatePath('/annotate')

  return {
    newClusters: newClustersCount,
    updatedClusters: updatedClustersCount,
    assignedFaces: assignedCount,
    unassignedFaces: unclusteredFaces.length - facesWithEmbedding.length,
  }
}

/**
 * 更新聚类的中心点
 */
export async function updateClusterCentroid(clusterId: string) {
  const clusterFaces = await db.query.faces.findMany({
    where: eq(faces.clusterId, clusterId),
  })

  const embeddings = clusterFaces
    .map((f) => f.embedding as number[] | null)
    .filter((e): e is number[] => e !== null && e.length > 0)

  if (embeddings.length === 0) {
    console.log('[updateClusterCentroid] No embeddings found for cluster:', clusterId)
    return
  }

  const newCentroid = meanVector(embeddings)

  await db
    .update(clusters)
    .set({
      centroid: newCentroid,
      faceCount: clusterFaces.length,
    })
    .where(eq(clusters.id, clusterId))
    
  console.log('[updateClusterCentroid] Updated centroid for cluster:', clusterId, 'faces:', embeddings.length)
}

/**
 * 重新计算所有聚类的中心点
 */
export async function recalculateAllCentroids() {
  const allClusters = await db.query.clusters.findMany({
    where: (clusters, { ne }) => ne(clusters.status, 'merged'),
  })

  console.log('[recalculateAllCentroids] Recalculating centroids for', allClusters.length, 'clusters')
  
  let updated = 0
  for (const cluster of allClusters) {
    await updateClusterCentroid(cluster.id)
    updated++
  }

  revalidatePath('/clusters')
  
  return { updated }
}

/**
 * 合并相似的聚类
 */
export async function mergeSimilarClusters(threshold: number = 0.7) {
  const pendingClusters = await db.query.clusters.findMany({
    where: eq(clusters.status, 'pending'),
  })

  const clustersWithCentroid = pendingClusters.filter(
    (c) => c.centroid && Array.isArray(c.centroid)
  )

  const mergedPairs: Array<[string, string]> = []
  const processedIds = new Set<string>()

  // 找出需要合并的聚类对
  for (let i = 0; i < clustersWithCentroid.length; i++) {
    if (processedIds.has(clustersWithCentroid[i].id)) continue

    for (let j = i + 1; j < clustersWithCentroid.length; j++) {
      if (processedIds.has(clustersWithCentroid[j].id)) continue

      const similarity = cosineSimilarity(
        clustersWithCentroid[i].centroid as number[],
        clustersWithCentroid[j].centroid as number[]
      )

      if (similarity >= threshold) {
        mergedPairs.push([clustersWithCentroid[i].id, clustersWithCentroid[j].id])
        processedIds.add(clustersWithCentroid[j].id)
      }
    }
  }

  // 执行合并
  for (const [keepId, mergeId] of mergedPairs) {
    // 将 mergeId 的人脸移动到 keepId
    await db
      .update(faces)
      .set({ clusterId: keepId })
      .where(eq(faces.clusterId, mergeId))

    // 标记 mergeId 为已合并
    await db
      .update(clusters)
      .set({ status: 'merged' })
      .where(eq(clusters.id, mergeId))

    // 更新 keepId 的中心点
    await updateClusterCentroid(keepId)
  }

  revalidatePath('/clusters')

  return { mergedCount: mergedPairs.length }
}
