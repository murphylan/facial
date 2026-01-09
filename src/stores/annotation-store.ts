import { create } from 'zustand'

interface DragState {
  faceId: string
  sourceClusterId: string
}

interface AnnotationStore {
  // State
  selectedFaceIds: Set<string>
  dragState: DragState | null
  isCompareMode: boolean
  compareFaceIds: [string, string] | null

  // Actions
  toggleFaceSelection: (id: string) => void
  selectFace: (id: string) => void
  deselectFace: (id: string) => void
  selectMultipleFaces: (ids: string[]) => void
  clearSelection: () => void
  setDragState: (state: DragState | null) => void
  setCompareMode: (value: boolean) => void
  setCompareFaces: (faces: [string, string] | null) => void
}

export const useAnnotationStore = create<AnnotationStore>((set) => ({
  selectedFaceIds: new Set(),
  dragState: null,
  isCompareMode: false,
  compareFaceIds: null,

  toggleFaceSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedFaceIds)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return { selectedFaceIds: newSet }
    }),

  selectFace: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedFaceIds)
      newSet.add(id)
      return { selectedFaceIds: newSet }
    }),

  deselectFace: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedFaceIds)
      newSet.delete(id)
      return { selectedFaceIds: newSet }
    }),

  selectMultipleFaces: (ids) =>
    set(() => ({
      selectedFaceIds: new Set(ids),
    })),

  clearSelection: () => set({ selectedFaceIds: new Set() }),

  setDragState: (state) => set({ dragState: state }),

  setCompareMode: (value) =>
    set({
      isCompareMode: value,
      compareFaceIds: value ? null : null,
    }),

  setCompareFaces: (faces) => set({ compareFaceIds: faces }),
}))
