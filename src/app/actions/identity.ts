'use server'

import { db } from '@/db'
import { identities, identityClusters, clusters } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getIdentities() {
  return await db.query.identities.findMany({
    orderBy: (identities, { desc }) => [desc(identities.createdAt)],
  })
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

  // 更新聚类状态为已确认
  await db
    .update(clusters)
    .set({ status: 'confirmed' })
    .where(eq(clusters.id, clusterId))

  revalidatePath('/identities')
  revalidatePath(`/identities/${identityId}`)
  revalidatePath('/clusters')

  return result[0]
}

export async function unlinkClusterFromIdentity(identityId: string, clusterId: string) {
  await db
    .delete(identityClusters)
    .where(
      eq(identityClusters.identityId, identityId) 
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
