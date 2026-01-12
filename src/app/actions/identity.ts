'use server'

import { db } from '@/db'
import { identities, identityClusters, clusters, faces } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { meanVector } from '@/lib/embedding'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getIdentities() {
  return await db.query.identities.findMany({
    orderBy: (identities, { desc }) => [desc(identities.createdAt)],
  })
}

/**
 * 诊断身份识别系统状态
 */
export async function diagnoseRecognitionSystem() {
  const allIdentities = await db.query.identities.findMany({
    with: {
      identityClusters: {
        with: {
          cluster: true,
        },
      },
    },
  })

  const diagnosis = {
    totalIdentities: allIdentities.length,
    identities: allIdentities.map((identity) => {
      const clustersInfo = identity.identityClusters.map((ic) => ({
        clusterId: ic.clusterId,
        hasCentroid: !!(ic.cluster?.centroid),
        centroidLength: ic.cluster?.centroid ? (ic.cluster.centroid as number[]).length : 0,
        faceCount: ic.cluster?.faceCount ?? 0,
        status: ic.cluster?.status,
      }))
      
      return {
        id: identity.id,
        name: identity.name,
        clustersCount: identity.identityClusters.length,
        clusters: clustersInfo,
        issues: [
          identity.identityClusters.length === 0 ? '没有关联聚类' : null,
          clustersInfo.some((c) => !c.hasCentroid) ? '存在没有 centroid 的聚类' : null,
          clustersInfo.some((c) => c.centroidLength !== 1024) ? 'centroid 维度不正确' : null,
        ].filter(Boolean),
      }
    }),
  }

  console.log('[diagnoseRecognitionSystem]', JSON.stringify(diagnosis, null, 2))
  
  return diagnosis
}

export async function getIdentityById(id: string) {
  return await db.query.identities.findFirst({
    where: eq(identities.id, id),
    with: {
      identityClusters: {
        with: {
          cluster: true,
        },
      },
    },
  })
}

export async function getIdentityWithFaces(id: string) {
  const identity = await db.query.identities.findFirst({
    where: eq(identities.id, id),
    with: {
      identityClusters: {
        with: {
          cluster: {
            with: {
              faces: true,
            },
          },
        },
      },
    },
  })

  if (!identity) return null

  // 扁平化所有人脸
  const faces = identity.identityClusters.flatMap(
    (ic) => ic.cluster?.faces ?? []
  )

  return {
    ...identity,
    faces,
  }
}

// ============================================
// 变更操作 - 供 useMutation 使用
// ============================================

export interface CreateIdentityInput {
  name: string
  description?: string
  avatarPath?: string
}

export async function createIdentity(data: CreateIdentityInput) {
  const result = await db
    .insert(identities)
    .values({
      id: generateId(),
      name: data.name,
      description: data.description,
      avatarPath: data.avatarPath,
    })
    .returning()

  revalidatePath('/identities')
  return result[0]
}

export interface UpdateIdentityInput {
  name?: string
  description?: string
  avatarPath?: string
}

export async function updateIdentity(id: string, data: UpdateIdentityInput) {
  const result = await db
    .update(identities)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(identities.id, id))
    .returning()

  revalidatePath('/identities')
  revalidatePath(`/identities/${id}`)
  return result[0]
}

export async function deleteIdentity(id: string) {
  await db.delete(identities).where(eq(identities.id, id))
  revalidatePath('/identities')
}

// ============================================
// 身份-聚类关联操作
// ============================================

export async function linkClusterToIdentity(identityId: string, clusterId: string) {
  // 检查是否已经关联
  const existing = await db.query.identityClusters.findFirst({
    where: (ic, { and, eq }) =>
      and(eq(ic.identityId, identityId), eq(ic.clusterId, clusterId)),
  })

  if (existing) {
    return existing
  }

  const result = await db
    .insert(identityClusters)
    .values({
      id: generateId(),
      identityId,
      clusterId,
    })
    .returning()

  // 确保聚类有正确的 centroid（如果没有则计算）
  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, clusterId),
  })
  
  if (!cluster?.centroid) {
    // 计算聚类的 centroid
    const clusterFaces = await db.query.faces.findMany({
      where: eq(faces.clusterId, clusterId),
    })
    
    const embeddings = clusterFaces
      .map((f) => f.embedding as number[] | null)
      .filter((e): e is number[] => e !== null && e.length > 0)
    
    if (embeddings.length > 0) {
      const centroid = meanVector(embeddings)
      await db
        .update(clusters)
        .set({ 
          centroid,
          status: 'confirmed',
          faceCount: clusterFaces.length,
        })
        .where(eq(clusters.id, clusterId))
      console.log('[linkClusterToIdentity] Calculated and saved centroid for cluster:', clusterId)
    } else {
      console.warn('[linkClusterToIdentity] No embeddings found for cluster:', clusterId)
      // 仅更新状态
      await db
        .update(clusters)
        .set({ status: 'confirmed' })
        .where(eq(clusters.id, clusterId))
    }
  } else {
    // 更新聚类状态为已确认
    await db
      .update(clusters)
      .set({ status: 'confirmed' })
      .where(eq(clusters.id, clusterId))
  }

  revalidatePath('/identities')
  revalidatePath(`/identities/${identityId}`)
  revalidatePath('/clusters')

  return result[0]
}

export async function unlinkClusterFromIdentity(identityId: string, clusterId: string) {
  // 只删除指定的身份-聚类关联
  await db
    .delete(identityClusters)
    .where(
      and(
        eq(identityClusters.identityId, identityId),
        eq(identityClusters.clusterId, clusterId)
      )
    )

  // 更新聚类状态为待处理
  await db
    .update(clusters)
    .set({ status: 'pending' })
    .where(eq(clusters.id, clusterId))

  revalidatePath('/identities')
  revalidatePath(`/identities/${identityId}`)
  revalidatePath('/clusters')
}

/**
 * 获取身份统计信息
 */
export async function getIdentityStats() {
  const allIdentities = await db.query.identities.findMany({
    with: {
      identityClusters: true,
    },
  })

  const total = allIdentities.length
  const withClusters = allIdentities.filter((i) => i.identityClusters.length > 0).length

  return {
    total,
    withClusters,
    withoutClusters: total - withClusters,
  }
}

/**
 * 批量关联聚类到身份
 */
export async function linkClustersToIdentity(identityId: string, clusterIds: string[]) {
  const results = []

  for (const clusterId of clusterIds) {
    const result = await linkClusterToIdentity(identityId, clusterId)
    results.push(result)
  }

  return results
}

/**
 * 创建身份并关联聚类
 */
export async function createIdentityWithClusters(
  data: CreateIdentityInput,
  clusterIds: string[]
) {
  const identity = await createIdentity(data)

  if (clusterIds.length > 0) {
    await linkClustersToIdentity(identity.id, clusterIds)
  }

  return identity
}
