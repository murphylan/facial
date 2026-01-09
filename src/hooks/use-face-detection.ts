'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCameraStore, type DetectedFace } from '@/stores/camera-store'
import { useSettingsStore } from '@/stores/settings-store'
import { saveFaceDetections, saveRecognitionFace, type DetectedFaceData } from '@/app/actions/detect'
import { recognizeFace } from '@/app/actions/recognition'

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

/**
 * 实时识别 Hook - 用于摄像头实时人脸识别
 */
export function useRealtimeRecognition() {
  const queryClient = useQueryClient()

  const recognizeMutation = useMutation({
    mutationFn: recognizeFace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitionLogs'] })
    },
  })

  const recognize = useCallback(async (
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

  return {
    recognize,
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
