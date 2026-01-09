import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getRecognitionLogs,
  getRecentRecognitions,
  getRecognitionStats,
  recognizeFace,
  deleteRecognitionLog,
  clearOldLogs,
  type RecognizeInput,
} from '@/app/actions/recognition'

// ============================================
// Query Hooks
// ============================================

export function useRecognitionLogs(options?: {
  cameraId?: string
  identityId?: string
  isStranger?: boolean
  limit?: number
  offset?: number
  since?: Date
}) {
  return useQuery({
    queryKey: ['recognitionLogs', options],
    queryFn: () => getRecognitionLogs(options),
  })
}

export function useRecentRecognitions(minutes: number = 60) {
  return useQuery({
    queryKey: ['recognitionLogs', 'recent', minutes],
    queryFn: () => getRecentRecognitions(minutes),
    refetchInterval: 5000, // 每 5 秒刷新
  })
}

export function useRecognitionStats(options?: { since?: Date }) {
  return useQuery({
    queryKey: ['recognitionLogs', 'stats', options],
    queryFn: () => getRecognitionStats(options),
  })
}

// ============================================
// Mutation Hooks
// ============================================

export function useRecognizeFace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RecognizeInput) => recognizeFace(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitionLogs'] })
    },
  })
}

export function useDeleteRecognitionLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRecognitionLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitionLogs'] })
    },
  })
}

export function useClearOldLogs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (daysToKeep: number) => clearOldLogs(daysToKeep),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitionLogs'] })
    },
  })
}
