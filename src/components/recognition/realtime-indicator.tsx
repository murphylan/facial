'use client'

import { Badge } from '@/components/ui/badge'
import { Activity, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RealtimeIndicatorProps {
  isActive: boolean
  count?: number
  label?: string
  className?: string
}

export function RealtimeIndicator({
  isActive,
  count,
  label = '实时',
  className,
}: RealtimeIndicatorProps) {
  return (
    <Badge
      variant={isActive ? 'default' : 'secondary'}
      className={cn(
        'gap-1',
        isActive && 'bg-green-500 hover:bg-green-600',
        className
      )}
    >
      {isActive ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          {label}
          {count !== undefined && <span>({count})</span>}
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          离线
        </>
      )}
    </Badge>
  )
}

interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  className?: string
}

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const config = {
    connected: {
      label: '已连接',
      icon: Wifi,
      color: 'bg-green-500',
    },
    connecting: {
      label: '连接中',
      icon: Activity,
      color: 'bg-yellow-500',
    },
    disconnected: {
      label: '未连接',
      icon: WifiOff,
      color: 'bg-gray-500',
    },
    error: {
      label: '连接错误',
      icon: WifiOff,
      color: 'bg-red-500',
    },
  }

  const { label, icon: Icon, color } = config[status]

  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
