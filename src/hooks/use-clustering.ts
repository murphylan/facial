import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  clusterUnassignedFaces,
  recalculateAllCentroids,
  mergeSimilarClusters,
} from '@/app/actions/clustering'

export function useClusterUnassignedFaces() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (threshold?: number) => clusterUnassignedFaces(threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useRecalculateCentroids() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => recalculateAllCentroids(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
    },
  })
}

export function useMergeSimilarClusters() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (threshold?: number) => mergeSimilarClusters(threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['faces'] })
    },
  })
}
