'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCameraStore, type DetectedFace } from '@/stores/camera-store'
import { useSettingsStore } from '@/stores/settings-store'
import { saveFaceDetections, saveRecognitionFace, type DetectedFaceData } from '@/app/actions/detect'
import { recognizeFace } from '@/app/actions/recognition'
import { cosineSimilarity } from '@/lib/embedding'

// 识别冷却时间（毫秒）- 同一人 3 分钟内不重复识别
const RECOGNITION_COOLDOWN_MS = 3 * 60 * 1000

// 判断是否为同一人的相似度阈值（提高到 0.5 以匹配更宽松的人脸变化）
// 注意：@vladmandic/human 的 embedding 相似度范围通常在 0.3-0.9
const SAME_PERSON_THRESHOLD = 0.5

// 已识别人员的缓存记录
interface RecognizedPerson {
  embedding: number[]
  identityId: string | null
  identityName: string | null
  isStranger: boolean
  confidence: number | null
  timestamp: number
  pending?: boolean // 正在识别中
}

// Human 实例（懒加载）
let humanInstance: any = null
let humanLoadPromise: Promise<any> | null = null

async function getHuman() {
  if (humanInstance) return humanInstance
  if (humanLoadPromise) return humanLoadPromise

  humanLoadPromise = (async () => {
    const Human = (await import('@vladmandic/human')).default
    
    humanInstance = new Human({
      modelBasePath: 'https://vladmandic.github.io/human-models/models/',
      backend: 'webgl',
      async: true,
      warmup: 'none',
      debug: false,
      face: {
        enabled: true,
        detector: {
          rotation: true,
          maxDetected: 10,
          minConfidence: 0.5,
          return: true,
        },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true }, // 包含 age/gender/embedding
        emotion: { enabled: true },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
    })

    await humanInstance.load()
    await humanInstance.warmup()
    
    return humanInstance
  })()

  return humanLoadPromise
}

/**
 * 人脸检测 Hook - 用于实时摄像头检测
 */
export function useFaceDetection() {
  const [isLoading, setIsLoading] = useState(false)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { updateDetections, setProcessing } = useCameraStore()
  const { detectionInterval, minFaceSize, maxFacesPerFrame } = useSettingsStore()
  
  const animationFrameRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const lastDetectionTimeRef = useRef(0)

  // 加载模型
  const loadModel = useCallback(async () => {
    if (isModelLoaded) return true
    
    setIsLoading(true)
    setError(null)
    
    try {
      await getHuman()
      setIsModelLoaded(true)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载模型失败'
      setError(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isModelLoaded])

  // 检测单帧
  const detectFrame = useCallback(async (
    video: HTMLVideoElement
  ): Promise<DetectedFace[]> => {
    const human = await getHuman()
    const result = await human.detect(video)

    return result.face
      .filter((face: any) => {
        const [, , w, h] = face.box
        return w >= minFaceSize && h >= minFaceSize
      })
      .slice(0, maxFacesPerFrame)
      .map((face: any, index: number) => ({
        id: `face_${Date.now()}_${index}`,
        bbox: {
          x: face.box[0],
          y: face.box[1],
          width: face.box[2],
          height: face.box[3],
        },
        confidence: face.score,
        embedding: face.embedding ?? undefined,
        age: face.age ?? undefined,
        gender: face.gender ?? undefined,
        emotion: getTopEmotion(face.emotion),
      }))
  }, [minFaceSize, maxFacesPerFrame])

  // 开始持续检测
  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (isRunningRef.current) return

    isRunningRef.current = true
    setProcessing(true)

    const detect = async () => {
      if (!isRunningRef.current) return

      const now = Date.now()
      if (now - lastDetectionTimeRef.current >= detectionInterval) {
        try {
          const faces = await detectFrame(video)
          updateDetections(faces)
          lastDetectionTimeRef.current = now
        } catch (err) {
          console.error('Detection error:', err)
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect)
    }

    detect()
  }, [detectionInterval, detectFrame, updateDetections, setProcessing])

  // 停止检测
  const stopDetection = useCallback(() => {
    if (!isRunningRef.current) return // 已经停止了，不需要重复操作
    
    isRunningRef.current = false
    setProcessing(false)
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    updateDetections([])
  }, [updateDetections, setProcessing])

  // 清理
  useEffect(() => {
    return () => {
      stopDetection()
    }
  }, [stopDetection])

  return {
    isLoading,
    isModelLoaded,
    error,
    loadModel,
    detectFrame,
    startDetection,
    stopDetection,
  }
}

/**
 * 图片人脸检测 Hook - 用于静态图片检测
 */
export function useImageFaceDetection() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const saveFacesMutation = useMutation({
    mutationFn: ({ imageId, detections }: { imageId: string; detections: DetectedFaceData[] }) =>
      saveFaceDetections(imageId, detections),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })

  // 检测图片中的人脸
  const detectImage = useCallback(async (
    imageElement: HTMLImageElement | HTMLCanvasElement
  ): Promise<DetectedFaceData[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const human = await getHuman()
      const result = await human.detect(imageElement)

      const detections: DetectedFaceData[] = result.face.map((face: any) => ({
        bbox: {
          x: face.box[0],
          y: face.box[1],
          width: face.box[2],
          height: face.box[3],
        },
        embedding: face.embedding ?? null,
        age: face.age ?? null,
        gender: parseGender(face.gender, face.genderScore),
        emotion: getTopEmotion(face.emotion),
        qualityScore: face.score,
      }))

      return detections
    } catch (err) {
      const message = err instanceof Error ? err.message : '检测失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 检测图片并保存结果
  const detectAndSave = useCallback(async (
    imageId: string,
    imageElement: HTMLImageElement | HTMLCanvasElement,
    canvas?: HTMLCanvasElement
  ) => {
    const detections = await detectImage(imageElement)

    // 生成人脸缩略图
    const detectionsWithThumbnails: DetectedFaceData[] = detections.map((detection) => {
      let thumbnailBase64: string | undefined

      if (canvas) {
        try {
          thumbnailBase64 = cropFace(canvas, detection.bbox)
        } catch (err) {
          console.error('Failed to crop face:', err)
        }
      }

      return {
        ...detection,
        thumbnailBase64,
      }
    })

    // 保存到数据库
    const result = await saveFacesMutation.mutateAsync({
      imageId,
      detections: detectionsWithThumbnails,
    })

    return result
  }, [detectImage, saveFacesMutation])

  // 从 URL 加载图片并检测
  const detectFromUrl = useCallback(async (
    imageId: string,
    imageUrl: string
  ) => {
    return new Promise<Awaited<ReturnType<typeof detectAndSave>>>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = async () => {
        try {
          // 创建 canvas
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Failed to get canvas context')
          ctx.drawImage(img, 0, 0)

          const result = await detectAndSave(imageId, canvas, canvas)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageUrl
    })
  }, [detectAndSave])

  return {
    isLoading,
    error,
    detectImage,
    detectAndSave,
    detectFromUrl,
    isSaving: saveFacesMutation.isPending,
  }
}

export interface RealtimeRecognitionOptions {
  // 当检测到陌生人时的回调（用于保存截图等）
  onStrangerDetected?: (face: DetectedFace) => void
}

/**
 * 实时识别 Hook - 用于摄像头实时人脸识别
 * 
 * 特性：
 * - 基于 embedding 相似度判断是否为同一人
 * - 同一人 3 分钟内不重复识别（冷却机制）
 * - 冷却期内直接显示缓存的识别结果
 */
export function useRealtimeRecognition(options?: RealtimeRecognitionOptions) {
  const { onStrangerDetected } = options ?? {}
  const queryClient = useQueryClient()
  const { updateFaceRecognition, incrementStats, setRecognizing } = useCameraStore()
  
  // 已识别人员的缓存（基于 embedding 相似度匹配）
  const recognizedPersonsRef = useRef<RecognizedPerson[]>([])
  // 正在处理中的人脸 ID（防止重复请求）
  const processingFacesRef = useRef<Set<string>>(new Set())
  // 是否正在执行识别循环（防止并发调用）
  const isRecognizingRef = useRef(false)

  const recognizeMutation = useMutation({
    mutationFn: recognizeFace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitionLogs'] })
    },
  })

  // 检查是否有相似的已识别人员（在冷却期内）或正在识别中
  const findCachedPerson = useCallback((embedding: number[]): RecognizedPerson | null => {
    const now = Date.now()
    
    // 清理过期缓存（保留 pending 状态的）
    recognizedPersonsRef.current = recognizedPersonsRef.current.filter(
      (person) => person.pending || (now - person.timestamp < RECOGNITION_COOLDOWN_MS)
    )

    // 查找相似的已识别人员（包括正在处理中的）
    for (const person of recognizedPersonsRef.current) {
      const similarity = cosineSimilarity(embedding, person.embedding)
      if (similarity >= SAME_PERSON_THRESHOLD) {
        return person
      }
    }

    return null
  }, [])

  // 添加 pending 状态到缓存（防止并发识别同一人）
  const addPendingToCache = useCallback((embedding: number[]) => {
    recognizedPersonsRef.current.push({
      embedding,
      identityId: null,
      identityName: null,
      isStranger: true,
      confidence: null,
      timestamp: Date.now(),
      pending: true,
    })
  }, [])

  // 更新缓存中的 pending 记录
  const updateCacheEntry = useCallback((
    embedding: number[],
    result: {
      identityId: string | null
      identityName: string | null
      isStranger: boolean
      confidence: number | null
    }
  ) => {
    // 查找并更新相似的 pending 记录
    for (const person of recognizedPersonsRef.current) {
      if (person.pending) {
        const similarity = cosineSimilarity(embedding, person.embedding)
        if (similarity >= SAME_PERSON_THRESHOLD) {
          person.identityId = result.identityId
          person.identityName = result.identityName
          person.isStranger = result.isStranger
          person.confidence = result.confidence
          person.timestamp = Date.now()
          person.pending = false
          return
        }
      }
    }

    // 如果没找到 pending 记录，添加新记录
    recognizedPersonsRef.current.push({
      embedding,
      identityId: result.identityId,
      identityName: result.identityName,
      isStranger: result.isStranger,
      confidence: result.confidence,
      timestamp: Date.now(),
      pending: false,
    })
  }, [])

  // 识别单个人脸
  const recognizeSingle = useCallback(async (
    embedding: number[],
    cameraId?: string,
    thumbnailPath?: string
  ) => {
    return recognizeMutation.mutateAsync({
      embedding,
      cameraId,
      thumbnailPath,
    })
  }, [recognizeMutation])

  // 批量识别检测到的人脸
  const recognizeFaces = useCallback(async (
    faces: DetectedFace[],
    cameraId?: string
  ) => {
    // 防止并发调用 - 如果已经在识别中，直接返回
    if (isRecognizingRef.current) return
    isRecognizingRef.current = true
    
    try {
      // 过滤出有 embedding 的人脸
      const facesWithEmbedding = faces.filter((face) => face.embedding)

      if (facesWithEmbedding.length === 0) return

      for (const face of facesWithEmbedding) {
        // 跳过正在处理的人脸 ID
        if (processingFacesRef.current.has(face.id)) continue

        // 检查缓存：是否是最近识别过的人（包括正在处理中的）
        const cachedPerson = findCachedPerson(face.embedding!)
        
        if (cachedPerson) {
          // 如果是 pending 状态，跳过（等待完成）
          if (cachedPerson.pending) {
            continue
          }
          
          // 使用缓存的识别结果（不发送新请求，不记录日志）
          updateFaceRecognition(face.id, {
            identityId: cachedPerson.identityId,
            identityName: cachedPerson.identityName,
            confidence: cachedPerson.confidence,
            isStranger: cachedPerson.isStranger,
            timestamp: cachedPerson.timestamp,
          })
          continue
        }

        // 先添加 pending 状态到缓存（防止并发识别同一人）
        addPendingToCache(face.embedding!)

        // 标记 face ID 为处理中
        processingFacesRef.current.add(face.id)
        setRecognizing(true)

        try {
          const result = await recognizeMutation.mutateAsync({
            embedding: face.embedding!,
            cameraId,
          })

          const recognitionResult = {
            identityId: result.identity?.id ?? null,
            identityName: result.identity?.name ?? null,
            confidence: result.confidence,
            isStranger: result.isStranger,
            timestamp: Date.now(),
          }

          // 更新人脸识别结果
          updateFaceRecognition(face.id, recognitionResult)

          // 更新缓存中的 pending 记录
          updateCacheEntry(face.embedding!, recognitionResult)

          // 更新统计
          incrementStats(result.isStranger)

          // 陌生人回调
          if (result.isStranger && onStrangerDetected) {
            onStrangerDetected(face)
          }

        } catch (err) {
          console.error('Recognition error for face:', face.id, err)
          // 移除失败的 pending 记录
          recognizedPersonsRef.current = recognizedPersonsRef.current.filter(
            (p) => !p.pending || cosineSimilarity(p.embedding, face.embedding!) < SAME_PERSON_THRESHOLD
          )
        } finally {
          processingFacesRef.current.delete(face.id)
          setRecognizing(false)
        }
      }
    } finally {
      // 识别循环结束，允许下一次调用
      isRecognizingRef.current = false
    }
  }, [recognizeMutation, updateFaceRecognition, incrementStats, setRecognizing, findCachedPerson, addPendingToCache, updateCacheEntry, onStrangerDetected])

  // 清理缓存（当检测停止时调用）
  const clearRecognitionCache = useCallback(() => {
    recognizedPersonsRef.current = []
    processingFacesRef.current.clear()
    isRecognizingRef.current = false
  }, [])

  // 获取缓存统计（调试用）
  const getCacheStats = useCallback(() => ({
    cachedPersons: recognizedPersonsRef.current.length,
    processingFaces: processingFacesRef.current.size,
  }), [])

  return {
    recognize: recognizeSingle,
    recognizeFaces,
    clearRecognitionCache,
    getCacheStats,
    isRecognizing: recognizeMutation.isPending,
    lastResult: recognizeMutation.data,
  }
}

// ============================================
// Helper functions
// ============================================

function parseGender(
  gender: string | undefined,
  score: number | undefined
): 'male' | 'female' | 'unknown' {
  if (!gender || (score && score < 0.5)) return 'unknown'
  if (gender === 'male') return 'male'
  if (gender === 'female') return 'female'
  return 'unknown'
}

function getTopEmotion(
  emotions: Array<{ score: number; emotion: string }> | undefined
): string | null {
  if (!emotions || emotions.length === 0) return null
  const sorted = [...emotions].sort((a, b) => b.score - a.score)
  return sorted[0].emotion
}

function cropFace(
  canvas: HTMLCanvasElement,
  bbox: { x: number; y: number; width: number; height: number },
  padding: number = 0.2
): string {
  const { x, y, width, height } = bbox

  // 添加 padding
  const padX = width * padding
  const padY = height * padding
  const cropX = Math.max(0, x - padX)
  const cropY = Math.max(0, y - padY)
  const cropWidth = Math.min(canvas.width - cropX, width + padX * 2)
  const cropHeight = Math.min(canvas.height - cropY, height + padY * 2)

  // 创建临时 canvas
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = cropWidth
  tempCanvas.height = cropHeight

  const ctx = tempCanvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  ctx.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  )

  return tempCanvas.toDataURL('image/jpeg', 0.85)
}
