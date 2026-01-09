'use server'

import { db } from '@/db'
import { faces, images } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

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
): Promise<{ imageId: string; faceId: string }> {
  const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './public/uploads'
  const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR ?? './public/thumbnails'
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  // 保存帧图片
  const frameDir = join(UPLOAD_DIR, 'camera', dateDir)
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
      framePublicPath = `/uploads/camera/${dateDir}/${filename}`
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

  return { imageId, faceId }
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
