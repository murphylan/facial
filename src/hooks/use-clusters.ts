import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getClusters,
  getClusterById,
  getPendingClusters,
  getClusterStats,
  createCluster,
  mergeClusters,
  splitCluster,
  deleteCluster,
  updateClusterStatus,
  moveFaceToCluster,
  moveFacesToCluster,
  setRepresentativeFace,
  removeFaceFromCluster,
  type CreateClusterInput,
} from '@/app/actions/cluster'

// ============================================
// Query Hooks
// ============================================

export function useClusters(status?: 'pending' | 'confirmed' | 'merged') {
  return useQuery({
    queryKey: ['clusters', { status }],
    queryFn: () => getClusters(status),
  })
}

export function useCluster(id: string) {
  return useQuery({
    queryKey: ['clusters', id],
    queryFn: () => getClusterById(id),
    enabled: !!id,
  })
}

export function usePendingClusters() {
  return useQuery({
    queryKey: ['clusters', 'pending'],
    queryFn: () => getPendingClusters(),
  })
}

export function useClusterStats() {
  return useQuery({
    queryKey: ['clusters', 'stats'],
    queryFn: () => getClusterStats(),
  })
}

// ============================================
// Mutation Hooks
// ============================================

export function useCreateCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClusterInput) => createCluster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}

export function useMergeClusters() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clusterIds: string[]) => mergeClusters(clusterIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}

export function useSplitCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clusterId, faceGroups }: { clusterId: string; faceGroups: string[][] }) =>
      splitCluster(clusterId, faceGroups),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}

export function useDeleteCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCluster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}

export function useUpdateClusterStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'confirmed' | 'merged' }) =>
      updateClusterStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['clusters', id] })
    },
  })
}

export function useMoveFaceToCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ faceId, targetClusterId }: { faceId: string; targetClusterId: string }) =>
      moveFaceToCluster(faceId, targetClusterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}

export function useMoveFacesToCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ faceIds, targetClusterId }: { faceIds: string[]; targetClusterId: string }) =>
      moveFacesToCluster(faceIds, targetClusterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}

export function useSetRepresentativeFace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clusterId, faceId }: { clusterId: string; faceId: string }) =>
      setRepresentativeFace(clusterId, faceId),
    onSuccess: (_, { clusterId }) => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['clusters', clusterId] })
    },
  })
}

export function useRemoveFaceFromCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (faceId: string) => removeFaceFromCluster(faceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}
