/**
 * 人脸聚类算法
 * 使用简单的层次聚类，适合 <100 人规模
 */

import { cosineSimilarity, meanVector } from './embedding'

export interface FaceData {
  id: string
  embedding: number[]
}

export interface ClusterResult {
  clusterId: string
  faceIds: string[]
  centroid: number[]
}

/**
 * 简单的凝聚层次聚类
 * @param faces 人脸数据数组
 * @param threshold 相似度阈值 (0-1)，越高越严格
 * @returns 聚类结果
 */
export function hierarchicalClustering(
  faces: FaceData[],
  threshold: number = 0.5
): ClusterResult[] {
  if (faces.length === 0) return []

  // 初始化：每个人脸是一个单独的聚类
  let clusters: {
    id: string
    faceIds: string[]
    embeddings: number[][]
  }[] = faces.map((face, index) => ({
    id: `cluster_${index}`,
    faceIds: [face.id],
    embeddings: [face.embedding],
  }))

  // 迭代合并最相似的聚类
  while (clusters.length > 1) {
    let maxSimilarity = -1
    let mergeI = -1
    let mergeJ = -1

    // 找到最相似的两个聚类
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const similarity = clusterSimilarity(
          clusters[i].embeddings,
          clusters[j].embeddings
        )
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity
          mergeI = i
          mergeJ = j
        }
      }
    }

    // 如果最大相似度低于阈值，停止合并
    if (maxSimilarity < threshold) break

    // 合并两个聚类
    const merged = {
      id: clusters[mergeI].id,
      faceIds: [...clusters[mergeI].faceIds, ...clusters[mergeJ].faceIds],
      embeddings: [...clusters[mergeI].embeddings, ...clusters[mergeJ].embeddings],
    }

    // 更新聚类列表
    clusters = clusters.filter((_, index) => index !== mergeI && index !== mergeJ)
    clusters.push(merged)
  }

  // 转换为输出格式
  return clusters.map((cluster) => ({
    clusterId: cluster.id,
    faceIds: cluster.faceIds,
    centroid: meanVector(cluster.embeddings),
  }))
}

/**
 * 计算两个聚类的相似度 (使用平均链接法)
 */
function clusterSimilarity(embeddingsA: number[][], embeddingsB: number[][]): number {
  let totalSimilarity = 0
  let count = 0

  for (const a of embeddingsA) {
    for (const b of embeddingsB) {
      totalSimilarity += cosineSimilarity(a, b)
      count++
    }
  }

  return totalSimilarity / count
}

/**
 * 增量聚类：将新的人脸分配到现有聚类或创建新聚类
 * @param newFace 新人脸
 * @param existingClusters 现有聚类
 * @param threshold 相似度阈值
 * @returns 分配的聚类 ID 或 null（需要创建新聚类）
 */
export function assignToCluster(
  newFace: FaceData,
  existingClusters: { clusterId: string; centroid: number[] }[],
  threshold: number = 0.5
): string | null {
  let bestClusterId: string | null = null
  let maxSimilarity = threshold

  for (const cluster of existingClusters) {
    const similarity = cosineSimilarity(newFace.embedding, cluster.centroid)
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      bestClusterId = cluster.clusterId
    }
  }

  return bestClusterId
}

/**
 * DBSCAN 聚类算法
 * 适合发现任意形状的聚类
 */
export function dbscan(
  faces: FaceData[],
  eps: number = 0.5, // 邻域半径（这里用 1 - similarity 作为距离）
  minPts: number = 2 // 最小点数
): ClusterResult[] {
  const n = faces.length
  const visited = new Array(n).fill(false)
  const clusterId = new Array(n).fill(-1) // -1 表示噪声

  let currentCluster = 0

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    visited[i] = true

    const neighbors = getNeighbors(faces, i, eps)

    if (neighbors.length < minPts) {
      clusterId[i] = -1 // 噪声点
    } else {
      expandCluster(faces, i, neighbors, currentCluster, eps, minPts, visited, clusterId)
      currentCluster++
    }
  }

  // 转换为输出格式
  const clusterMap = new Map<number, { faceIds: string[]; embeddings: number[][] }>()

  for (let i = 0; i < n; i++) {
    const cid = clusterId[i]
    if (cid === -1) {
      // 噪声点作为单独的聚类
      clusterMap.set(-i - 2, {
        faceIds: [faces[i].id],
        embeddings: [faces[i].embedding],
      })
    } else {
      if (!clusterMap.has(cid)) {
        clusterMap.set(cid, { faceIds: [], embeddings: [] })
      }
      clusterMap.get(cid)!.faceIds.push(faces[i].id)
      clusterMap.get(cid)!.embeddings.push(faces[i].embedding)
    }
  }

  return Array.from(clusterMap.entries()).map(([id, data]) => ({
    clusterId: `cluster_${id}`,
    faceIds: data.faceIds,
    centroid: meanVector(data.embeddings),
  }))
}

function getNeighbors(faces: FaceData[], pointIndex: number, eps: number): number[] {
  const neighbors: number[] = []
  const point = faces[pointIndex]

  for (let i = 0; i < faces.length; i++) {
    if (i === pointIndex) continue
    const distance = 1 - cosineSimilarity(point.embedding, faces[i].embedding)
    if (distance <= eps) {
      neighbors.push(i)
    }
  }

  return neighbors
}

function expandCluster(
  faces: FaceData[],
  pointIndex: number,
  neighbors: number[],
  clusterId: number,
  eps: number,
  minPts: number,
  visited: boolean[],
  clusterIds: number[]
): void {
  clusterIds[pointIndex] = clusterId

  const queue = [...neighbors]

  while (queue.length > 0) {
    const current = queue.shift()!

    if (!visited[current]) {
      visited[current] = true
      const currentNeighbors = getNeighbors(faces, current, eps)

      if (currentNeighbors.length >= minPts) {
        queue.push(...currentNeighbors)
      }
    }

    if (clusterIds[current] === -1) {
      clusterIds[current] = clusterId
    }
  }
}
