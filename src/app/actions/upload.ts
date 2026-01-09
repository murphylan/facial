'use server'

import { db } from '@/db'
import { images } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateId } from '@/lib/utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// ============================================
// 查询操作 - 供 useQuery 使用
// ============================================

export async function getImages(options?: {
  sourceType?: 'upload' | 'camera' | 'video'
  processed?: boolean
  limit?: number
  offset?: number
}) {
  const { sourceType, processed, limit = 50, offset = 0 } = options ?? {}

  return await db.query.images.findMany({
    where: (images, { eq, and }) => {
      const conditions = []
      if (sourceType) conditions.push(eq(images.sourceType, sourceType))
      if (processed !== undefined) conditions.push(eq(images.processed, processed))
      return conditions.length > 0 ? and(...conditions) : undefined
    },
    limit,
    offset,
    orderBy: (images, { desc }) => [desc(images.uploadedAt)],
    with: {
      faces: true,
    },
  })
}

export async function getImageById(id: string) {
  return await db.query.images.findFirst({
    where: eq(images.id, id),
    with: {
      faces: true,
    },
  })
}

export async function getUnprocessedImages() {
  return await getImages({ processed: false })
}

// ============================================
// 变更操作 - 供 useMutation 使用
// ============================================

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './public/uploads'

export async function uploadImage(formData: FormData) {
  const file = formData.get('file') as File
  if (!file) {
    throw new Error('No file provided')
  }

  // 验证文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Supported: JPEG, PNG, WebP, GIF')
  }

  // 创建上传目录
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const uploadPath = join(UPLOAD_DIR, dateDir)
  await mkdir(uploadPath, { recursive: true })

  // 生成文件名
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${generateId()}.${ext}`
  const filePath = join(uploadPath, filename)
  const publicPath = `/uploads/${dateDir}/${filename}`

  // 写入文件
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  // 保存到数据库
  const result = await db
    .insert(images)
    .values({
      id: generateId(),
      sourceType: 'upload',
      filePath: publicPath,
      processed: false,
    })
    .returning()

  revalidatePath('/upload')
  return result[0]
}

export async function uploadImages(formData: FormData) {
  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    throw new Error('No files provided')
  }

  const results = []
  for (const file of files) {
    const singleFormData = new FormData()
    singleFormData.set('file', file)
    const result = await uploadImage(singleFormData)
    results.push(result)
  }

  return results
}

export async function markImageProcessed(id: string, facesDetected: number = 0) {
  const result = await db
    .update(images)
    .set({ processed: true })
    .where(eq(images.id, id))
    .returning()

  revalidatePath('/upload')
  return result[0]
}

export async function deleteImage(id: string) {
  // TODO: 删除物理文件
  await db.delete(images).where(eq(images.id, id))
  revalidatePath('/upload')
}

// ============================================
// 摄像头帧保存
// ============================================

export async function saveCameraFrame(
  base64Data: string,
  cameraId: string
) {
  // 从 base64 提取数据
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid base64 image data')
  }

  const ext = matches[1]
  const data = matches[2]
  const buffer = Buffer.from(data, 'base64')

  // 创建上传目录
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const uploadPath = join(UPLOAD_DIR, 'camera', dateDir)
  await mkdir(uploadPath, { recursive: true })

  // 生成文件名
  const filename = `${generateId()}.${ext}`
  const filePath = join(uploadPath, filename)
  const publicPath = `/uploads/camera/${dateDir}/${filename}`

  // 写入文件
  await writeFile(filePath, buffer)

  // 保存到数据库
  const result = await db
    .insert(images)
    .values({
      id: generateId(),
      sourceType: 'camera',
      sourceId: cameraId,
      filePath: publicPath,
      processed: false,
    })
    .returning()

  return result[0]
}
