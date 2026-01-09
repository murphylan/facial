'use server'

import { db } from '@/db'
import { cameras, images } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getCameras() {
  return await db.query.cameras.findMany({
    orderBy: (cameras, { asc }) => [asc(cameras.name)],
  })
}

export async function getCameraById(id: string) {
  return await db.query.cameras.findFirst({
    where: eq(cameras.id, id),
  })
}

export async function getOnlineCameras() {
  return await db.query.cameras.findMany({
    where: eq(cameras.status, 'online'),
  })
}

// ============================================
// 变更操作 - 供 useMutation 使用
// ============================================

export interface CreateCameraInput {
  name: string
  type: 'local' | 'remote' | 'ip'
  streamUrl?: string
}

export async function createCamera(data: CreateCameraInput) {
  const result = await db
    .insert(cameras)
    .values({
      id: generateId(),
      name: data.name,
      type: data.type,
      streamUrl: data.streamUrl,
      status: 'offline',
    })
    .returning()

  revalidatePath('/settings')
  return result[0]
}

export interface UpdateCameraInput {
  name?: string
  type?: 'local' | 'remote' | 'ip'
  streamUrl?: string
  status?: 'online' | 'offline'
}

export async function updateCamera(id: string, data: UpdateCameraInput) {
  const result = await db
    .update(cameras)
    .set(data)
    .where(eq(cameras.id, id))
    .returning()

  revalidatePath('/settings')
  revalidatePath('/camera')
  return result[0]
}

export async function setCameraStatus(id: string, status: 'online' | 'offline') {
  return await updateCamera(id, { status })
}

export async function deleteCamera(id: string) {
  await db.delete(cameras).where(eq(cameras.id, id))
  revalidatePath('/settings')
}

// ============================================
// 默认本地摄像头管理
// ============================================

export async function ensureDefaultCamera() {
  // 检查是否已有本地摄像头
  const existingLocal = await db.query.cameras.findFirst({
    where: eq(cameras.type, 'local'),
  })

  if (existingLocal) {
    return existingLocal
  }

  // 创建默认本地摄像头
  const result = await db
    .insert(cameras)
    .values({
      id: generateId(),
      name: '本地摄像头',
      type: 'local',
      status: 'offline',
    })
    .returning()

  revalidatePath('/settings')
  return result[0]
}

// ============================================
// 截图保存功能
// ============================================

export interface CaptureFrameInput {
  cameraId: string
  frameBase64: string
  metadata?: {
    width?: number
    height?: number
    timestamp?: string
  }
}

export interface CaptureFrameResult {
  imageId: string
  filePath: string
  publicPath: string
}

/**
 * 保存摄像头截图
 */
export async function captureFrame(input: CaptureFrameInput): Promise<CaptureFrameResult> {
  const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './public/uploads'
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const frameDir = join(UPLOAD_DIR, 'camera', input.cameraId, dateDir)

  // 创建目录
  await mkdir(frameDir, { recursive: true })

  const imageId = generateId()

  // 解析 base64
  const matches = input.frameBase64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid image format')
  }

  const ext = matches[1]
  const data = matches[2]
  const buffer = Buffer.from(data, 'base64')
  const filename = `${imageId}.${ext}`
  const filePath = join(frameDir, filename)

  // 写入文件
  await writeFile(filePath, buffer)

  const publicPath = `/uploads/camera/${input.cameraId}/${dateDir}/${filename}`

  // 保存到数据库
  await db.insert(images).values({
    id: imageId,
    sourceType: 'camera',
    sourceId: input.cameraId,
    filePath: publicPath,
    processed: false,
  })

  revalidatePath('/camera')
  revalidatePath('/upload')

  return {
    imageId,
    filePath,
    publicPath,
  }
}

/**
 * 批量保存截图
 */
export async function captureFrames(
  inputs: CaptureFrameInput[]
): Promise<CaptureFrameResult[]> {
  const results: CaptureFrameResult[] = []

  for (const input of inputs) {
    const result = await captureFrame(input)
    results.push(result)
  }

  return results
}
