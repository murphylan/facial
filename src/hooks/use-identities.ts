import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getIdentities,
  getIdentityById,
  getIdentityWithFaces,
  getIdentityStats,
  createIdentity,
  updateIdentity,
  deleteIdentity,
  linkClusterToIdentity,
  unlinkClusterFromIdentity,
  linkClustersToIdentity,
  createIdentityWithClusters,
  type CreateIdentityInput,
  type UpdateIdentityInput,
} from '@/app/actions/identity'

// ============================================
// Query Hooks
// ============================================

export function useIdentities() {
  return useQuery({
    queryKey: ['identities'],
    queryFn: () => getIdentities(),
  })
}

export function useIdentity(id: string) {
  return useQuery({
    queryKey: ['identities', id],
    queryFn: () => getIdentityById(id),
    enabled: !!id,
  })
}

export function useIdentityWithFaces(id: string) {
  return useQuery({
    queryKey: ['identities', id, 'faces'],
    queryFn: () => getIdentityWithFaces(id),
    enabled: !!id,
  })
}

// ============================================
// Mutation Hooks
// ============================================

export function useCreateIdentity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateIdentityInput) => createIdentity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
  })
}

export function useUpdateIdentity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIdentityInput }) =>
      updateIdentity(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      queryClient.invalidateQueries({ queryKey: ['identities', id] })
    },
  })
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteIdentity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
  })
}

export function useLinkCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ identityId, clusterId }: { identityId: string; clusterId: string }) =>
      linkClusterToIdentity(identityId, clusterId),
    onSuccess: (_, { identityId }) => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      queryClient.invalidateQueries({ queryKey: ['identities', identityId] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useUnlinkCluster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ identityId, clusterId }: { identityId: string; clusterId: string }) =>
      unlinkClusterFromIdentity(identityId, clusterId),
    onSuccess: (_, { identityId }) => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      queryClient.invalidateQueries({ queryKey: ['identities', identityId] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useIdentityStats() {
  return useQuery({
    queryKey: ['identities', 'stats'],
    queryFn: () => getIdentityStats(),
  })
}

export function useLinkClusters() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ identityId, clusterIds }: { identityId: string; clusterIds: string[] }) =>
      linkClustersToIdentity(identityId, clusterIds),
    onSuccess: (_, { identityId }) => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      queryClient.invalidateQueries({ queryKey: ['identities', identityId] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useCreateIdentityWithClusters() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ data, clusterIds }: { data: CreateIdentityInput; clusterIds: string[] }) =>
      createIdentityWithClusters(data, clusterIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}
