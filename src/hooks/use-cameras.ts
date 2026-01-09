import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCameras,
  getCameraById,
  getOnlineCameras,
  createCamera,
  updateCamera,
  deleteCamera,
  setCameraStatus,
  ensureDefaultCamera,
  captureFrame,
  captureFrames,
  type CreateCameraInput,
  type UpdateCameraInput,
  type CaptureFrameInput,
} from '@/app/actions/camera'

// ============================================
// Query Hooks
// ============================================

export function useCameras() {
  return useQuery({
    queryKey: ['cameras'],
    queryFn: () => getCameras(),
  })
}

export function useCamera(id: string) {
  return useQuery({
    queryKey: ['cameras', id],
    queryFn: () => getCameraById(id),
    enabled: !!id,
  })
}

export function useOnlineCameras() {
  return useQuery({
    queryKey: ['cameras', 'online'],
    queryFn: () => getOnlineCameras(),
  })
}

// ============================================
// Mutation Hooks
// ============================================

export function useCreateCamera() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCameraInput) => createCamera(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
    },
  })
}

export function useUpdateCamera() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCameraInput }) =>
      updateCamera(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
      queryClient.invalidateQueries({ queryKey: ['cameras', id] })
    },
  })
}

export function useDeleteCamera() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCamera(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
    },
  })
}

export function useSetCameraStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'online' | 'offline' }) =>
      setCameraStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
      queryClient.invalidateQueries({ queryKey: ['cameras', id] })
    },
  })
}

export function useEnsureDefaultCamera() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ensureDefaultCamera(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
    },
  })
}

// ============================================
// 截图相关 Hooks
// ============================================

/**
 * 截图保存 hook
 */
export function useCaptureFrame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CaptureFrameInput) => captureFrame(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
  })
}

/**
 * 批量截图保存 hook
 */
export function useCaptureFrames() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (inputs: CaptureFrameInput[]) => captureFrames(inputs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
  })
}
