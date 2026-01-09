import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFaces,
  getFaceById,
  getUnclusteredFaces,
  getFaceStats,
  createFace,
  createFaces,
  updateFaceCluster,
  moveFacesToCluster,
  deleteFace,
  type CreateFaceInput,
} from '@/app/actions/face'

// ============================================
// Query Hooks
// ============================================

export function useFaces(options?: {
  clusterId?: string
  imageId?: string
  unclustered?: boolean
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['faces', options],
    queryFn: () => getFaces(options),
  })
}

export function useFace(id: string) {
  return useQuery({
    queryKey: ['faces', id],
    queryFn: () => getFaceById(id),
    enabled: !!id,
  })
}

export function useUnclusteredFaces() {
  return useQuery({
    queryKey: ['faces', 'unclustered'],
    queryFn: () => getUnclusteredFaces(),
  })
}

export function useFaceStats() {
  return useQuery({
    queryKey: ['faces', 'stats'],
    queryFn: () => getFaceStats(),
  })
}

// ============================================
// Mutation Hooks
// ============================================

export function useCreateFace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateFaceInput) => createFace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faces'] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useCreateFaces() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dataList: CreateFaceInput[]) => createFaces(dataList),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faces'] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useUpdateFaceCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ faceId, clusterId }: { faceId: string; clusterId: string | null }) =>
      updateFaceCluster(faceId, clusterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faces'] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useMoveFacesToCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ faceIds, targetClusterId }: { faceIds: string[]; targetClusterId: string }) =>
      moveFacesToCluster(faceIds, targetClusterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faces'] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useDeleteFace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteFace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faces'] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}
