import { create } from 'zustand'

export interface DetectedFace {
  id: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  embedding?: number[]
  age?: number
  gender?: string
  emotion?: string
}

interface CameraStore {
  // State
  isStreaming: boolean
  currentFrame: ImageData | null
  detectedFaces: DetectedFace[]
  selectedCameraId: string | null
  isProcessing: boolean

  // Actions
  setStreaming: (value: boolean) => void
  updateFrame: (frame: ImageData | null) => void
  updateDetections: (faces: DetectedFace[]) => void
  setSelectedCamera: (cameraId: string | null) => void
  setProcessing: (value: boolean) => void
  reset: () => void
}

const initialState = {
  isStreaming: false,
  currentFrame: null,
  detectedFaces: [],
  selectedCameraId: null,
  isProcessing: false,
}

export const useCameraStore = create<CameraStore>((set) => ({
  ...initialState,

  setStreaming: (value) => set({ isStreaming: value }),

  updateFrame: (frame) => set({ currentFrame: frame }),

  updateDetections: (faces) => set({ detectedFaces: faces }),

  setSelectedCamera: (cameraId) => set({ selectedCameraId: cameraId }),

  setProcessing: (value) => set({ isProcessing: value }),

  reset: () => set(initialState),
}))
