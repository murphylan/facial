import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  // Recognition settings
  recognitionThreshold: number // 识别阈值 (0-1)
  clusteringThreshold: number // 聚类阈值 (0-1)

  // Detection settings
  minFaceSize: number // 最小人脸尺寸 (px)
  maxFacesPerFrame: number // 每帧最大检测人脸数
  detectionInterval: number // 检测间隔 (ms)

  // UI settings
  showBoundingBoxes: boolean
  showConfidence: boolean
  showAgeGender: boolean
  gridSize: 'small' | 'medium' | 'large'

  // Actions
  setRecognitionThreshold: (value: number) => void
  setClusteringThreshold: (value: number) => void
  setMinFaceSize: (value: number) => void
  setMaxFacesPerFrame: (value: number) => void
  setDetectionInterval: (value: number) => void
  setShowBoundingBoxes: (value: boolean) => void
  setShowConfidence: (value: boolean) => void
  setShowAgeGender: (value: boolean) => void
  setGridSize: (value: 'small' | 'medium' | 'large') => void
  resetToDefaults: () => void
}

const defaultSettings = {
  recognitionThreshold: 0.6,
  clusteringThreshold: 0.5,
  minFaceSize: 50,
  maxFacesPerFrame: 10,
  detectionInterval: 100,
  showBoundingBoxes: true,
  showConfidence: true,
  showAgeGender: false,
  gridSize: 'medium' as const,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setRecognitionThreshold: (value) => set({ recognitionThreshold: value }),
      setClusteringThreshold: (value) => set({ clusteringThreshold: value }),
      setMinFaceSize: (value) => set({ minFaceSize: value }),
      setMaxFacesPerFrame: (value) => set({ maxFacesPerFrame: value }),
      setDetectionInterval: (value) => set({ detectionInterval: value }),
      setShowBoundingBoxes: (value) => set({ showBoundingBoxes: value }),
      setShowConfidence: (value) => set({ showConfidence: value }),
      setShowAgeGender: (value) => set({ showAgeGender: value }),
      setGridSize: (value) => set({ gridSize: value }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'facial-recognition-settings',
    }
  )
)
