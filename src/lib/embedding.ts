/**
 * 向量操作工具函数
 */

/**
 * 计算两个向量的余弦相似度
 * @param a 向量 A
 * @param b 向量 B
 * @returns 相似度 (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * 计算两个向量的余弦距离
 * @param a 向量 A
 * @param b 向量 B
 * @returns 距离 (0-2)
 */
export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b)
}

/**
 * 计算两个向量的欧氏距离
 * @param a 向量 A
 * @param b 向量 B
 * @returns 距离
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }

  return Math.sqrt(sum)
}

/**
 * 计算向量的均值 (用于计算聚类中心)
 * @param vectors 向量数组
 * @returns 均值向量
 */
export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('Cannot compute mean of empty array')
  }

  const dim = vectors[0].length
  const result = new Array(dim).fill(0)

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i]
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length
  }

  return result
}

/**
 * 归一化向量
 * @param vec 输入向量
 * @returns 归一化后的向量
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

/**
 * 找到最相似的向量
 * @param query 查询向量
 * @param candidates 候选向量数组
 * @param threshold 相似度阈值
 * @returns 最相似的索引和相似度，如果没有找到返回 null
 */
export function findMostSimilar(
  query: number[],
  candidates: { embedding: number[]; id: string }[],
  threshold: number = 0.5
): { id: string; similarity: number } | null {
  let bestMatch: { id: string; similarity: number } | null = null

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(query, candidate.embedding)
    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { id: candidate.id, similarity }
      }
    }
  }

  return bestMatch
}

/**
 * 找到所有相似的向量
 * @param query 查询向量
 * @param candidates 候选向量数组
 * @param threshold 相似度阈值
 * @param limit 最大返回数量
 * @returns 相似的向量列表（按相似度降序）
 */
export function findSimilar(
  query: number[],
  candidates: { embedding: number[]; id: string }[],
  threshold: number = 0.5,
  limit: number = 10
): { id: string; similarity: number }[] {
  const results: { id: string; similarity: number }[] = []

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(query, candidate.embedding)
    if (similarity >= threshold) {
      results.push({ id: candidate.id, similarity })
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}
