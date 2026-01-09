'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecognitionBadgeProps {
  isStranger: boolean | null
  confidence?: number | null
  showConfidence?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RecognitionBadge({
  isStranger,
  confidence,
  showConfidence = true,
  size = 'md',
  className,
}: RecognitionBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const iconClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  if (isStranger === null) {
    return (
      <Badge variant="outline" className={cn(sizeClasses[size], className)}>
        <HelpCircle className={cn(iconClasses[size], 'mr-1')} />
        未知
      </Badge>
    )
  }

  if (isStranger) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'bg-yellow-100 text-yellow-700 border-yellow-300',
          sizeClasses[size],
          className
        )}
      >
        <AlertTriangle className={cn(iconClasses[size], 'mr-1')} />
        陌生人
      </Badge>
    )
  }

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'bg-green-100 text-green-700 border-green-300'
    if (conf >= 0.6) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-red-100 text-red-700 border-red-300'
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        confidence ? getConfidenceColor(confidence) : 'bg-green-100 text-green-700',
        sizeClasses[size],
        className
      )}
    >
      <CheckCircle className={cn(iconClasses[size], 'mr-1')} />
      已识别
      {showConfidence && confidence && (
        <span className="ml-1">({(confidence * 100).toFixed(0)}%)</span>
      )}
    </Badge>
  )
}
