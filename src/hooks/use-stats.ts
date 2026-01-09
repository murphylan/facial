import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getRecentActivity,
  getHourlyRecognitionStats,
  getTopIdentities,
} from '@/app/actions/stats'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => getDashboardStats(),
    refetchInterval: 30000, // 每30秒刷新
  })
}

export function useRecentActivity(limit: number = 10) {
  return useQuery({
    queryKey: ['stats', 'activity', limit],
    queryFn: () => getRecentActivity(limit),
    refetchInterval: 10000, // 每10秒刷新
  })
}

export function useHourlyStats() {
  return useQuery({
    queryKey: ['stats', 'hourly'],
    queryFn: () => getHourlyRecognitionStats(),
    refetchInterval: 60000, // 每分钟刷新
  })
}

export function useTopIdentities(limit: number = 5) {
  return useQuery({
    queryKey: ['stats', 'topIdentities', limit],
    queryFn: () => getTopIdentities(limit),
    refetchInterval: 60000, // 每分钟刷新
  })
}
