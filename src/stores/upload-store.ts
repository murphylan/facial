import { create } from 'zustand'

export interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  imageId?: string // 上传成功后的 image ID
  facesDetected?: number // 检测到的人脸数量
}

interface UploadStore {
  // State
  items: UploadItem[]
  isUploading: boolean

  // Actions
  addItems: (files: File[]) => void
  updateItem: (id: string, updates: Partial<UploadItem>) => void
  removeItem: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void
  setUploading: (value: boolean) => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  items: [],
  isUploading: false,

  addItems: (files) =>
    set((state) => ({
      items: [
        ...state.items,
        ...files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: 'pending' as const,
          progress: 0,
        })),
      ],
    })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),

  clearCompleted: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'completed'),
    })),

  clearAll: () => set({ items: [] }),

  setUploading: (value) => set({ isUploading: value }),
}))
