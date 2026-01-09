'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Merge,
  Sparkles,
  Trash2,
  Check,
  RefreshCw,
  Loader2,
  Filter,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface ClusterToolbarProps {
  selectedCount: number
  totalCount: number
  statusFilter: 'all' | 'pending' | 'confirmed' | 'merged'
  onStatusFilterChange: (status: 'all' | 'pending' | 'confirmed' | 'merged') => void
  onRunClustering?: () => void
  onMergeSelected?: () => void
  onConfirmSelected?: () => void
  onDeleteSelected?: () => void
  onClearSelection?: () => void
  isClusteringRunning?: boolean
  isMerging?: boolean
}

export function ClusterToolbar({
  selectedCount,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  onRunClustering,
  onMergeSelected,
  onConfirmSelected,
  onDeleteSelected,
  onClearSelection,
  isClusteringRunning,
  isMerging,
}: ClusterToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card border rounded-lg">
      {/* 筛选 */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={onStatusFilterChange as (value: string) => void}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="pending">待标注</SelectItem>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="merged">已合并</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* 聚类操作 */}
      {onRunClustering && (
        <Button
          variant="outline"
          onClick={onRunClustering}
          disabled={isClusteringRunning}
        >
          {isClusteringRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          运行聚类
        </Button>
      )}

      <Separator orientation="vertical" className="h-8" />

      {/* 选中操作 */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{selectedCount} 选中</Badge>

        {selectedCount >= 2 && onMergeSelected && (
          <Button
            variant="outline"
            size="sm"
            onClick={onMergeSelected}
            disabled={isMerging}
          >
            {isMerging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Merge className="mr-2 h-4 w-4" />
            )}
            合并选中
          </Button>
        )}

        {selectedCount > 0 && onConfirmSelected && (
          <Button variant="outline" size="sm" onClick={onConfirmSelected}>
            <Check className="mr-2 h-4 w-4" />
            确认选中
          </Button>
        )}

        {selectedCount > 0 && onDeleteSelected && (
          <Button variant="outline" size="sm" onClick={onDeleteSelected}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除选中
          </Button>
        )}

        {selectedCount > 0 && onClearSelection && (
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            取消选择
          </Button>
        )}
      </div>

      {/* 统计 */}
      <div className="ml-auto text-sm text-muted-foreground">
        共 {totalCount} 个聚类
      </div>
    </div>
  )
}
