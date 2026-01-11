import { create } from 'zustand'

export interface RecognitionResult {
  identityId: string | null
  identityName: string | null
  confidence: number | null
  isStranger: boolean
  timestamp: number
}

export interface DetectedFace {
  id: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  embedding?: number[]
  age?: number
  gender?: string
  emotion?: string
  recognition?: RecognitionResult
}

// 全局 MediaStream 管理器 - 在组件外部保持 stream 存活
class StreamManager {
  private stream: MediaStream | null = null
  private deviceId: string | undefined = undefined

  getStream() {
    return this.stream
  }

  getDeviceId() {
    return this.deviceId
  }

  setStream(stream: MediaStream | null, deviceId?: string) {
    this.stream = stream
    this.deviceId = deviceId
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
      this.deviceId = undefined
    }
  }

  isActive() {
    return this.stream !== null && this.stream.active
  }
}

export const streamManager = new StreamManager()

interface CameraStore {
  // 基础状态
  isStreaming: boolean
  currentFrame: ImageData | null
  detectedFaces: DetectedFace[]
  selectedCameraId: string | null
  isProcessing: boolean
  isRecognizing: boolean
  recognitionStats: {
    total: number
    identified: number
    strangers: number
  }

  // 新增：页面状态（跨导航保持）
  isDetecting: boolean
  autoRecognize: boolean
  autoSaveStrangers: boolean
  selectedDeviceId: string | undefined
  localCameraId: string | null
  savedStrangersCount: number
  capturedCount: number
  error: string | null

  // 基础 Actions
  setStreaming: (value: boolean) => void
  updateFrame: (frame: ImageData | null) => void
  updateDetections: (faces: DetectedFace[]) => void
  updateFaceRecognition: (faceId: string, result: RecognitionResult) => void
  setSelectedCamera: (cameraId: string | null) => void
  setProcessing: (value: boolean) => void
  setRecognizing: (value: boolean) => void
  incrementStats: (isStranger: boolean) => void
  reset: () => void

  // 新增 Actions
  setDetecting: (value: boolean) => void
  setAutoRecognize: (value: boolean) => void
  setAutoSaveStrangers: (value: boolean) => void
  setSelectedDeviceId: (deviceId: string | undefined) => void
  setLocalCameraId: (cameraId: string | null) => void
  incrementSavedStrangers: () => void
  incrementCaptured: () => void
  setError: (error: string | null) => void
  resetStats: () => void
}

const initialState = {
  isStreaming: false,
  currentFrame: null,
  detectedFaces: [] as DetectedFace[],
  selectedCameraId: null,
  isProcessing: false,
  isRecognizing: false,
  recognitionStats: {
    total: 0,
    identified: 0,
    strangers: 0,
  },
  // 新增状态
  isDetecting: false,
  autoRecognize: false,
  autoSaveStrangers: true, // 默认开启
  selectedDeviceId: undefined as string | undefined,
  localCameraId: null as string | null,
  savedStrangersCount: 0,
  capturedCount: 0,
  error: null as string | null,
}

export const useCameraStore = create<CameraStore>((set, get) => ({
  ...initialState,

  setStreaming: (value) => {
    if (get().isStreaming !== value) {
      set({ isStreaming: value })
    }
  },

  updateFrame: (frame) => set({ currentFrame: frame }),

  updateDetections: (faces) => {
    // 避免空数组到空数组的无效更新
    const current = get().detectedFaces
    if (faces.length === 0 && current.length === 0) return
    set({ detectedFaces: faces })
  },

  updateFaceRecognition: (faceId, result) => {
    const faces = get().detectedFaces
    const updatedFaces = faces.map((face) =>
      face.id === faceId ? { ...face, recognition: result } : face
    )
    set({ detectedFaces: updatedFaces })
  },

  setSelectedCamera: (cameraId) => {
    if (get().selectedCameraId !== cameraId) {
      set({ selectedCameraId: cameraId })
    }
  },

  setProcessing: (value) => {
    if (get().isProcessing !== value) {
      set({ isProcessing: value })
    }
  },

  setRecognizing: (value) => {
    if (get().isRecognizing !== value) {
      set({ isRecognizing: value })
    }
  },

  incrementStats: (isStranger) => {
    const stats = get().recognitionStats
    set({
      recognitionStats: {
        total: stats.total + 1,
        identified: isStranger ? stats.identified : stats.identified + 1,
        strangers: isStranger ? stats.strangers + 1 : stats.strangers,
      },
    })
  },

  // 新增 Actions
  setDetecting: (value) => {
    if (get().isDetecting !== value) {
      set({ isDetecting: value })
    }
  },

  setAutoRecognize: (value) => {
    if (get().autoRecognize !== value) {
      set({ autoRecognize: value })
    }
  },

  setAutoSaveStrangers: (value) => {
    if (get().autoSaveStrangers !== value) {
      set({ autoSaveStrangers: value })
    }
  },

  setSelectedDeviceId: (deviceId) => {
    if (get().selectedDeviceId !== deviceId) {
      set({ selectedDeviceId: deviceId })
    }
  },

  setLocalCameraId: (cameraId) => {
    if (get().localCameraId !== cameraId) {
      set({ localCameraId: cameraId })
    }
  },

  incrementSavedStrangers: () => {
    set({ savedStrangersCount: get().savedStrangersCount + 1 })
  },

  incrementCaptured: () => {
    set({ capturedCount: get().capturedCount + 1 })
  },

  setError: (error) => {
    set({ error })
  },

  resetStats: () => {
    set({
      recognitionStats: { total: 0, identified: 0, strangers: 0 },
      savedStrangersCount: 0,
      capturedCount: 0,
    })
  },

  reset: () => {
    streamManager.stopStream()
    set(initialState)
  },
}))
