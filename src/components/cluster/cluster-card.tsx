'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, MoreHorizontal, Check, Merge, Trash2, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface ClusterCardData {
  id: string
  faceCount: number
  status: string
  createdAt: Date | null
  representativeFaceId: string | null
  faces: Array<{
    id: string
    thumbnailPath: string | null
  }>
}

interface ClusterCardProps {
  cluster: ClusterCardData
  selected?: boolean
  onSelect?: (id: string) => void
  onConfirm?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

export function ClusterCard({
  cluster,
  selected,
  onSelect,
  onConfirm,
  onDelete,
  className,
}: ClusterCardProps) {
  const statusConfig = {
    pending: { label: '待标注', color: 'bg-yellow-500' },
    confirmed: { label: '已确认', color: 'bg-green-500' },
    merged: { label: '已合并', color: 'bg-gray-500' },
  }

  const status = statusConfig[cluster.status as keyof typeof statusConfig] ?? statusConfig.pending
  const previewFaces = cluster.faces.slice(0, 4)
  const remainingCount = cluster.faceCount - previewFaces.length

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary',
        className
      )}
      onClick={() => onSelect?.(cluster.id)}
    >
      <CardContent className="p-4">
        {/* 选中指示器 */}
        {selected && (
          <div className="absolute top-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </div>
        )}

        {/* 菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/clusters/${cluster.id}`}>
                <Users className="mr-2 h-4 w-4" />
                查看详情
              </Link>
            </DropdownMenuItem>
            {cluster.status === 'pending' && onConfirm && (
              <DropdownMenuItem onClick={() => onConfirm(cluster.id)}>
                <Check className="mr-2 h-4 w-4" />
                确认聚类
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(cluster.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 人脸预览网格 */}
        <Link href={`/clusters/${cluster.id}`} onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-1 aspect-square mb-3 rounded-lg overflow-hidden bg-muted">
            {previewFaces.map((face, index) => (
              <div key={face.id} className="relative aspect-square bg-muted">
                {face.thumbnailPath ? (
                  <img
                    src={face.thumbnailPath}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                {index === 3 && remainingCount > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-medium">
                    +{remainingCount}
                  </div>
                )}
              </div>
            ))}
            {previewFaces.length < 4 &&
              Array.from({ length: 4 - previewFaces.length }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square bg-muted" />
              ))}
          </div>
        </Link>

        {/* 信息 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{cluster.faceCount} 张人脸</span>
          </div>
          <Badge variant="secondary" className={cn('text-white', status.color)}>
            {status.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
