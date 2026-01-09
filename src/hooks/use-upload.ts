import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getImages,
  getImageById,
  getUnprocessedImages,
  uploadImage,
  uploadImages,
  markImageProcessed,
  deleteImage,
  saveCameraFrame,
} from '@/app/actions/upload'

// ============================================
// Query Hooks
// ============================================

export function useImages(options?: {
  sourceType?: 'upload' | 'camera' | 'video'
  processed?: boolean
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['images', options],
    queryFn: () => getImages(options),
  })
}

export function useImage(id: string) {
  return useQuery({
    queryKey: ['images', id],
    queryFn: () => getImageById(id),
    enabled: !!id,
  })
}

export function useUnprocessedImages() {
  return useQuery({
    queryKey: ['images', 'unprocessed'],
    queryFn: () => getUnprocessedImages(),
  })
}

// ============================================
// Mutation Hooks
// ============================================

export function useUploadImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (formData: FormData) => uploadImage(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
  })
}

export function useUploadImages() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (formData: FormData) => uploadImages(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
  })
}

export function useMarkImageProcessed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, facesDetected }: { id: string; facesDetected?: number }) =>
      markImageProcessed(id, facesDetected),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
      queryClient.invalidateQueries({ queryKey: ['images', id] })
    },
  })
}

export function useDeleteImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
  })
}

export function useSaveCameraFrame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ base64Data, cameraId }: { base64Data: string; cameraId: string }) =>
      saveCameraFrame(base64Data, cameraId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
  })
}
