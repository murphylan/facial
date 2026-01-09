/**
 * @vladmandic/human AI 库封装
 * 用于人脸检测和特征提取
 * 
 * 注意：此模块仅在客户端使用
 */

// Human 配置
const humanConfig = {
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  backend: 'webgl' as const,
  async: true,
  warmup: 'none' as const,
  debug: false,

  face: {
    enabled: true,
    detector: {
      rotation: true,
      maxDetected: 10,
      minConfidence: 0.5,
      return: true,
    },
    mesh: {
      enabled: true,
    },
    iris: {
      enabled: false,
    },
    description: {
      enabled: true, // 生成人脸描述向量 (embedding)
    },
    emotion: {
      enabled: true,
    },
    antispoof: {
      enabled: false, // 可选: 活体检测
    },
    liveness: {
      enabled: false, // 可选: 活体检测
    },
  },

  body: {
    enabled: false,
  },
  hand: {
    enabled: false,
  },
  gesture: {
    enabled: false,
  },
  object: {
    enabled: false,
  },
  segmentation: {
    enabled: false,
  },
}

// 单例 Human 实例
let humanInstance: any = null
let isLoading = false
let loadPromise: Promise<any> | null = null

/**
 * 获取 Human 实例（懒加载，仅客户端）
 */
export async function getHuman(): Promise<any> {
  // 确保只在客户端运行
  if (typeof window === 'undefined') {
    throw new Error('Human can only be used on the client side')
  }

  if (humanInstance) {
    return humanInstance
  }

  if (loadPromise) {
    return loadPromise
  }

  isLoading = true
  loadPromise = (async () => {
    // 动态导入 - 只加载浏览器版本
    const HumanModule = await import('@vladmandic/human')
    const Human = HumanModule.default
    
    const human = new Human(humanConfig)
    await human.load()
    await human.warmup()
    humanInstance = human
    isLoading = false
    return human
  })()

  return loadPromise
}

/**
 * 检测结果类型
 */
export interface DetectionResult {
  id: string
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
  embedding: number[] | null
  age: number | null
  gender: 'male' | 'female' | 'unknown'
  genderConfidence: number
  emotion: string | null
  emotionConfidence: number
}

/**
 * 从图片检测人脸
 */
export async function detectFaces(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData
): Promise<DetectionResult[]> {
  const human = await getHuman()
  const result = await human.detect(input)

  return result.face.map((face: any, index: number) => ({
    id: `face_${Date.now()}_${index}`,
    bbox: {
      x: face.box[0],
      y: face.box[1],
      width: face.box[2],
      height: face.box[3],
    },
    confidence: face.score,
    embedding: face.embedding ?? null,
    age: face.age ?? null,
    gender: parseGender(face.gender, face.genderScore),
    genderConfidence: face.genderScore ?? 0,
    emotion: parseEmotion(face.emotion),
    emotionConfidence: getEmotionConfidence(face.emotion),
  }))
}

/**
 * 从视频帧检测人脸
 */
export async function detectFacesFromVideo(
  video: HTMLVideoElement
): Promise<DetectionResult[]> {
  return detectFaces(video)
}

/**
 * 从 base64 图片检测人脸
 */
export async function detectFacesFromBase64(
  base64: string
): Promise<DetectionResult[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        const results = await detectFaces(img)
        resolve(results)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = reject
    img.src = base64
  })
}

/**
 * 比较两个人脸的相似度
 */
export async function compareFaces(
  embedding1: number[],
  embedding2: number[]
): Promise<number> {
  const human = await getHuman()
  return human.similarity(embedding1, embedding2)
}

/**
 * 在画布上绘制人脸检测框
 */
export function drawFaceBoxes(
  ctx: CanvasRenderingContext2D,
  faces: DetectionResult[],
  options?: {
    color?: string
    lineWidth?: number
    showLabels?: boolean
    labelFont?: string
  }
): void {
  const {
    color = '#00ff00',
    lineWidth = 2,
    showLabels = true,
    labelFont = '14px sans-serif',
  } = options ?? {}

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.font = labelFont

  for (const face of faces) {
    const { x, y, width, height } = face.bbox

    // 绘制边框
    ctx.strokeRect(x, y, width, height)

    // 绘制标签
    if (showLabels) {
      const label = `${face.age?.toFixed(0) ?? '?'}岁 ${face.gender === 'male' ? '男' : face.gender === 'female' ? '女' : '?'}`
      const confidence = `${(face.confidence * 100).toFixed(0)}%`

      ctx.fillStyle = color
      ctx.fillText(label, x, y - 5)
      ctx.fillText(confidence, x, y + height + 15)
    }
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

function parseEmotion(
  emotions: Array<{ score: number; emotion: string }> | undefined
): string | null {
  if (!emotions || emotions.length === 0) return null
  const sorted = [...emotions].sort((a, b) => b.score - a.score)
  return sorted[0].emotion
}

function getEmotionConfidence(
  emotions: Array<{ score: number; emotion: string }> | undefined
): number {
  if (!emotions || emotions.length === 0) return 0
  const sorted = [...emotions].sort((a, b) => b.score - a.score)
  return sorted[0].score
}

/**
 * 裁剪人脸区域
 */
export function cropFace(
  canvas: HTMLCanvasElement,
  face: DetectionResult,
  padding: number = 0.2
): string {
  const { x, y, width, height } = face.bbox

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

  return tempCanvas.toDataURL('image/jpeg', 0.9)
}

/**
 * 检查 Human 是否已加载
 */
export function isHumanLoaded(): boolean {
  return humanInstance !== null
}

/**
 * 检查 Human 是否正在加载
 */
export function isHumanLoading(): boolean {
  return isLoading
}
