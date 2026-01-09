'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RecognitionBadge } from './recognition-badge'
import { User, Clock, Camera } from 'lucide-react'
import { formatRelativeTime, cn } from '@/lib/utils'
import Link from 'next/link'

interface RecognitionResultProps {
  isStranger: boolean
  confidence: number | null
  identity?: {
    id: string
    name: string
    avatarPath: string | null
  } | null
  thumbnailPath?: string | null
  cameraName?: string | null
  timestamp?: Date | null
  showLink?: boolean
  className?: string
}

export function RecognitionResult({
  isStranger,
  confidence,
  identity,
  thumbnailPath,
  cameraName,
  timestamp,
  showLink = true,
  className,
}: RecognitionResultProps) {
  const content = (
    <Card className={cn('transition-colors', showLink && 'hover:bg-muted/50', className)}>
      <CardContent className="flex items-center gap-4 p-4">
        {/* 人脸缩略图 */}
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted overflow-hidden flex-shrink-0">
          {thumbnailPath ? (
            <img src={thumbnailPath} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isStranger ? (
              <span className="font-semibold text-yellow-600">陌生人</span>
            ) : identity ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={identity.avatarPath ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {identity.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold">{identity.name}</span>
              </div>
            ) : (
              <span className="font-semibold text-muted-foreground">未知</span>
            )}
            <RecognitionBadge
              isStranger={isStranger}
              confidence={confidence}
              size="sm"
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {cameraName && (
              <span className="flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {cameraName}
              </span>
            )}
            {timestamp && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(timestamp)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (showLink && identity) {
    return <Link href={`/identities/${identity.id}`}>{content}</Link>
  }

  return content
}
