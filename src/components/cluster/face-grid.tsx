'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Check,
  Star,
  Trash2,
  MoreHorizontal,
  Move,
  ZoomIn,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface FaceData {
  id: string
  thumbnailPath: string | null
  age: number | null
  gender: string | null
  emotion: string | null
  qualityScore: number | null
  createdAt: Date | null
}

interface FaceGridProps {
  faces: FaceData[]
  selectedIds?: Set<string>
  onSelect?: (id: string) => void
  onSelectAll?: () => void
  onClearSelection?: () => void
  representativeFaceId?: string | null
  onSetRepresentative?: (id: string) => void
  onRemove?: (id: string) => void
  onMove?: (id: string) => void
  gridSize?: 'small' | 'medium' | 'large'
  selectable?: boolean
  className?: string
}

const gridSizeClasses = {
  small: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
  medium: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
  large: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

export function FaceGrid({
  faces,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  onClearSelection,
  representativeFaceId,
  onSetRepresentative,
  onRemove,
  onMove,
  gridSize = 'medium',
  selectable = true,
  className,
}: FaceGridProps) {
  const [previewFace, setPreviewFace] = useState<FaceData | null>(null)

  const allSelected = faces.length > 0 && selectedIds.size === faces.length

  return (
    <>
      {/* 工具栏 */}
      {selectable && (onSelectAll || onClearSelection) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedIds.size} / {faces.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onSelectAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                disabled={allSelected}
              >
                全选
              </Button>
            )}
            {onClearSelection && selectedIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={onClearSelection}>
                取消选择
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 网格 */}
      <div className={cn('grid gap-3', gridSizeClasses[gridSize], className)}>
        {faces.map((face) => (
          <FaceCard
            key={face.id}
            face={face}
            selected={selectedIds.has(face.id)}
            isRepresentative={face.id === representativeFaceId}
            selectable={selectable}
            onSelect={onSelect}
            onSetRepresentative={onSetRepresentative}
            onRemove={onRemove}
            onMove={onMove}
            onPreview={() => setPreviewFace(face)}
          />
        ))}
      </div>

      {/* 预览对话框 */}
      <Dialog open={!!previewFace} onOpenChange={() => setPreviewFace(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>人脸详情</DialogTitle>
          </DialogHeader>
          {previewFace && (
            <div className="space-y-4">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                {previewFace.thumbnailPath ? (
                  <img
                    src={previewFace.thumbnailPath}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {previewFace.age && (
                  <div>
                    <span className="text-muted-foreground">年龄：</span>
                    {previewFace.age.toFixed(0)}岁
                  </div>
                )}
                {previewFace.gender && (
                  <div>
                    <span className="text-muted-foreground">性别：</span>
                    {previewFace.gender === 'male' ? '男' : previewFace.gender === 'female' ? '女' : '未知'}
                  </div>
                )}
                {previewFace.emotion && (
                  <div>
                    <span className="text-muted-foreground">表情：</span>
                    {translateEmotion(previewFace.emotion)}
                  </div>
                )}
                {previewFace.qualityScore && (
                  <div>
                    <span className="text-muted-foreground">质量：</span>
                    {(previewFace.qualityScore * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface FaceCardProps {
  face: FaceData
  selected?: boolean
  isRepresentative?: boolean
  selectable?: boolean
  onSelect?: (id: string) => void
  onSetRepresentative?: (id: string) => void
  onRemove?: (id: string) => void
  onMove?: (id: string) => void
  onPreview?: () => void
}

function FaceCard({
  face,
  selected,
  isRepresentative,
  selectable,
  onSelect,
  onSetRepresentative,
  onRemove,
  onMove,
  onPreview,
}: FaceCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary',
        isRepresentative && 'ring-2 ring-yellow-500'
      )}
      onClick={() => selectable && onSelect?.(face.id)}
    >
      {/* 代表人脸标记 */}
      {isRepresentative && (
        <Badge
          className="absolute top-1 left-1 z-10 bg-yellow-500 text-white"
          variant="secondary"
        >
          <Star className="h-3 w-3 mr-1" />
          代表
        </Badge>
      )}

      {/* 选中标记 */}
      {selected && (
        <div className="absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* 菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onPreview && (
            <DropdownMenuItem onClick={onPreview}>
              <ZoomIn className="mr-2 h-4 w-4" />
              查看详情
            </DropdownMenuItem>
          )}
          {onSetRepresentative && !isRepresentative && (
            <DropdownMenuItem onClick={() => onSetRepresentative(face.id)}>
              <Star className="mr-2 h-4 w-4" />
              设为代表
            </DropdownMenuItem>
          )}
          {onMove && (
            <DropdownMenuItem onClick={() => onMove(face.id)}>
              <Move className="mr-2 h-4 w-4" />
              移动到其他聚类
            </DropdownMenuItem>
          )}
          {onRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onRemove(face.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                移除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 图片 */}
      <div className="aspect-square">
        {face.thumbnailPath ? (
          <img
            src={face.thumbnailPath}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 信息覆盖层 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-xs text-white">
          {face.age && <span>{face.age.toFixed(0)}岁</span>}
          {face.gender && (
            <span className="ml-1">
              {face.gender === 'male' ? '男' : face.gender === 'female' ? '女' : ''}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

function translateEmotion(emotion: string): string {
  const emotionMap: Record<string, string> = {
    happy: '开心',
    sad: '悲伤',
    angry: '愤怒',
    fearful: '恐惧',
    disgusted: '厌恶',
    surprised: '惊讶',
    neutral: '平静',
  }
  return emotionMap[emotion] ?? emotion
}
