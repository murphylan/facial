'use server'

import { db } from '@/db'
import { faces, images, clusters } from '@/db/schema'
import { eq, gte, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { cosineSimilarity, meanVector } from '@/lib/embedding'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// 增量聚类阈值
const CLUSTERING_THRESHOLD = 0.5

// 服务端去重配置
const DEDUP_TIME_WINDOW_MS = 10 * 60 * 1000 // 10 分钟内不重复保存同一人
const DEDUP_SIMILARITY_THRESHOLD = 0.7 // 相似度 >= 0.7 视为同一人

// ============================================
// 人脸检测相关 Server Actions
// ============================================

export interface DetectedFaceData {
  bbox: { x: number; y: number; width: number; height: number }
  embedding: number[] | null
  age: number | null
  gender: 'male' | 'female' | 'unknown'
  emotion: string | null
  qualityScore: number
  thumbnailBase64?: string // 人脸缩略图 base64
}

export interface ProcessImageResult {
  imageId: string
  facesDetected: number
  faces: Array<{
    id: string
    bbox: { x: number; y: number; width: number; height: number }
    age: number | null
    gender: string | null
    emotion: string | null
  }>
}

/**
 * 保存检测到的人脸数据
 */
export async function saveFaceDetections(
  imageId: string,
  detections: DetectedFaceData[]
): Promise<ProcessImageResult> {
  const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR ?? './public/thumbnails'
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const thumbnailPath = join(THUMBNAILS_DIR, dateDir)

  // 创建缩略图目录
  await mkdir(thumbnailPath, { recursive: true })

  const savedFaces: ProcessImageResult['faces'] = []

  for (const detection of detections) {
    const faceId = generateId()
    let thumbnailPublicPath: string | undefined

    // 保存缩略图
    if (detection.thumbnailBase64) {
      try {
        const matches = detection.thumbnailBase64.match(/^data:image\/(\w+);base64,(.+)$/)
        if (matches) {
          const ext = matches[1]
          const data = matches[2]
          const buffer = Buffer.from(data, 'base64')
          const filename = `${faceId}.${ext}`
          const filePath = join(thumbnailPath, filename)
          await writeFile(filePath, buffer)
          thumbnailPublicPath = `/thumbnails/${dateDir}/${filename}`
        }
      } catch (error) {
        console.error('Failed to save thumbnail:', error)
      }
    }

    // 保存人脸数据到数据库
    await db.insert(faces).values({
      id: faceId,
      imageId,
      bbox: detection.bbox,
      embedding: detection.embedding,
      qualityScore: detection.qualityScore,
      age: detection.age,
      gender: detection.gender,
      emotion: detection.emotion,
      thumbnailPath: thumbnailPublicPath,
    })

    savedFaces.push({
      id: faceId,
      bbox: detection.bbox,
      age: detection.age,
      gender: detection.gender,
      emotion: detection.emotion,
    })
  }

  // 标记图片已处理
  await db.update(images).set({ processed: true }).where(eq(images.id, imageId))

  revalidatePath('/upload')
  revalidatePath('/clusters')

  return {
    imageId,
    facesDetected: savedFaces.length,
    faces: savedFaces,
  }
}

/**
 * 保存摄像头识别的人脸（实时识别用）
 */
export async function saveRecognitionFace(
  cameraId: string,
  detection: DetectedFaceData,
  frameBase64: string
): Promise<{ imageId: string; faceId: string; clusterId: string | null; skipped?: boolean }> {
  console.log('[saveRecognitionFace] Starting save for camera:', cameraId, 'hasEmbedding:', !!detection.embedding)
  
  // 服务端去重检查：检查最近是否已保存过高度相似的人脸
  if (detection.embedding && Array.isArray(detection.embedding)) {
    const embedding = detection.embedding as number[]
    const cutoffTime = new Date(Date.now() - DEDUP_TIME_WINDOW_MS)
    
    // 获取同一摄像头最近的人脸记录
    const recentFaces = await db.query.faces.findMany({
      where: and(
        gte(faces.createdAt, cutoffTime)
      ),
      with: {
        image: true,
      },
      limit: 50,
      orderBy: (faces, { desc }) => [desc(faces.createdAt)],
    })
    
    // 筛选同一摄像头的人脸并检查相似度
    const sameCameraFaces = recentFaces.filter(
      (f) => f.image?.sourceType === 'camera' && f.image?.sourceId === cameraId
    )
    
    for (const face of sameCameraFaces) {
      if (face.embedding) {
        const similarity = cosineSimilarity(embedding, face.embedding as number[])
        if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
          console.log('[saveRecognitionFace] Skipped: similar face already saved recently, similarity:', similarity.toFixed(3))
          // 返回已存在的人脸信息，避免重复保存
          return { 
            imageId: face.imageId ?? '', 
            faceId: face.id, 
            clusterId: face.clusterId,
            skipped: true,
          }
        }
      }
    }
  }
  
  const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './public/uploads'
  const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR ?? './public/thumbnails'
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  // 保存帧图片
  const frameDir = join(UPLOAD_DIR, 'camera', cameraId, dateDir)
  await mkdir(frameDir, { recursive: true })

  const imageId = generateId()
  let framePublicPath = ''

  try {
    const matches = frameBase64.match(/^data:image\/(\w+);base64,(.+)$/)
    if (matches) {
      const ext = matches[1]
      const data = matches[2]
      const buffer = Buffer.from(data, 'base64')
      const filename = `${imageId}.${ext}`
      const filePath = join(frameDir, filename)
      await writeFile(filePath, buffer)
      framePublicPath = `/uploads/camera/${cameraId}/${dateDir}/${filename}`
    }
  } catch (error) {
    console.error('Failed to save frame:', error)
  }

  // 保存图片记录
  await db.insert(images).values({
    id: imageId,
    sourceType: 'camera',
    sourceId: cameraId,
    filePath: framePublicPath,
    processed: true,
  })

  // 保存缩略图
  const thumbnailDir = join(THUMBNAILS_DIR, dateDir)
  await mkdir(thumbnailDir, { recursive: true })

  const faceId = generateId()
  let thumbnailPublicPath: string | undefined

  if (detection.thumbnailBase64) {
    try {
      const matches = detection.thumbnailBase64.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches) {
        const ext = matches[1]
        const data = matches[2]
        const buffer = Buffer.from(data, 'base64')
        const filename = `${faceId}.${ext}`
        const filePath = join(thumbnailDir, filename)
        await writeFile(filePath, buffer)
        thumbnailPublicPath = `/thumbnails/${dateDir}/${filename}`
      }
    } catch (error) {
      console.error('Failed to save thumbnail:', error)
    }
  }

  // 保存人脸记录
  await db.insert(faces).values({
    id: faceId,
    imageId,
    bbox: detection.bbox,
    embedding: detection.embedding,
    qualityScore: detection.qualityScore,
    age: detection.age,
    gender: detection.gender,
    emotion: detection.emotion,
    thumbnailPath: thumbnailPublicPath,
  })

  // 增量聚类 - 自动将新人脸加入现有聚类或创建新聚类
  let clusterId: string | null = null
  if (detection.embedding && Array.isArray(detection.embedding)) {
    const embedding = detection.embedding as number[]
    
    // 获取所有活跃的聚类（pending 和 confirmed，排除 merged）
    // 这样可以将新人脸分配到已标注的聚类中，避免创建重复聚类
    const existingClusters = await db.query.clusters.findMany({
      where: (clusters, { ne }) => ne(clusters.status, 'merged'),
    })
    
    // 查找最匹配的聚类
    let bestMatch: { clusterId: string; similarity: number } | null = null
    for (const cluster of existingClusters) {
      if (cluster.centroid) {
        const similarity = cosineSimilarity(embedding, cluster.centroid as number[])
        if (similarity >= CLUSTERING_THRESHOLD) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { clusterId: cluster.id, similarity }
          }
        }
      }
    }
    
    if (bestMatch) {
      // 分配到现有聚类
      clusterId = bestMatch.clusterId
      console.log('[saveRecognitionFace] Assigned to existing cluster:', clusterId, 'similarity:', bestMatch.similarity.toFixed(3))
      await db.update(faces).set({ clusterId }).where(eq(faces.id, faceId))
      
      // 更新聚类的中心点和人脸数量
      const clusterFaces = await db.query.faces.findMany({
        where: eq(faces.clusterId, clusterId),
      })
      const embeddings = clusterFaces
        .map((f) => f.embedding as number[] | null)
        .filter((e): e is number[] => e !== null && e.length > 0)
      
      if (embeddings.length > 0) {
        const newCentroid = meanVector(embeddings)
        await db.update(clusters).set({
          centroid: newCentroid,
          faceCount: clusterFaces.length,
        }).where(eq(clusters.id, clusterId))
      }
    } else {
      // 创建新聚类
      clusterId = generateId()
      await db.insert(clusters).values({
        id: clusterId,
        faceCount: 1,
        representativeFaceId: faceId,
        centroid: embedding,
        status: 'pending',
      })
      await db.update(faces).set({ clusterId }).where(eq(faces.id, faceId))
      console.log('[saveRecognitionFace] Created new cluster:', clusterId)
    }
    
    revalidatePath('/clusters')
  }

  console.log('[saveRecognitionFace] Saved face:', faceId, 'cluster:', clusterId)
  return { imageId, faceId, clusterId }
}

/**
 * 批量处理未处理的图片
 */
export async function getUnprocessedImageIds(): Promise<string[]> {
  const unprocessed = await db.query.images.findMany({
    where: eq(images.processed, false),
    columns: { id: true },
  })

  return unprocessed.map((img) => img.id)
}
