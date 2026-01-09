'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useClusters,
  useClusterStats,
  useMergeClusters,
  useDeleteCluster,
  useUpdateClusterStatus,
} from '@/hooks/use-clusters'
import { useFaceStats } from '@/hooks/use-faces'
import { useClusterUnassignedFaces, useMergeSimilarClusters } from '@/hooks/use-clustering'
import {
  Users,
  Layers,
  CheckCircle,
  GitMerge,
  Sparkles,
  Loader2,
  AlertCircle,
  Trash2,
  Check,
  MoreHorizontal,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export default function ClustersPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null)

  const { data: stats, isLoading: statsLoading } = useClusterStats()
  const { data: faceStats, isLoading: faceStatsLoading } = useFaceStats()
  const { data: clusters, isLoading: clustersLoading } = useClusters()

  const clusterMutation = useClusterUnassignedFaces()
  const mergeSimilarMutation = useMergeSimilarClusters()
  const mergeSelectedMutation = useMergeClusters()
  const deleteMutation = useDeleteCluster()
  const updateStatusMutation = useUpdateClusterStatus()

  const handleCluster = async () => {
    try {
      const result = await clusterMutation.mutateAsync(0.5)
      toast.success(
        `聚类完成: 创建 ${result.newClusters} 个新聚类，更新 ${result.updatedClusters} 个聚类，分配 ${result.assignedFaces} 张人脸`
      )
    } catch {
      toast.error('聚类处理失败')
    }
  }

  const handleMergeSimilar = async () => {
    try {
      const result = await mergeSimilarMutation.mutateAsync(0.7)
      toast.success(`合并完成: 合并了 ${result.mergedCount} 对相似聚类`)
    } catch {
      toast.error('合并处理失败')
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleMergeSelected = async () => {
    if (selectedIds.size < 2) {
      toast.error('请至少选择 2 个聚类')
      return
    }

    try {
      await mergeSelectedMutation.mutateAsync(Array.from(selectedIds))
      toast.success('合并成功')
      clearSelection()
    } catch {
      toast.error('合并失败')
    }
  }

  const handleConfirmSelected = async () => {
    const ids = Array.from(selectedIds)
    try {
      for (const id of ids) {
        await updateStatusMutation.mutateAsync({ id, status: 'confirmed' })
      }
      toast.success(`已确认 ${ids.length} 个聚类`)
      clearSelection()
    } catch {
      toast.error('确认失败')
    }
  }

  const handleDeleteCluster = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('删除成功')
      setClusterToDelete(null)
      setDeleteDialogOpen(false)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch {
      toast.error('删除失败')
    }
  }

  const unclusteredCount = faceStats?.unclustered ?? 0

  return (
    <>
      <Header title="聚类浏览" />
      <div className="flex-1 space-y-6 p-6">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="待标注"
            value={statsLoading ? '-' : String(stats?.pending ?? 0)}
            icon={Layers}
            color="text-yellow-500"
          />
          <StatsCard
            title="已确认"
            value={statsLoading ? '-' : String(stats?.confirmed ?? 0)}
            icon={CheckCircle}
            color="text-green-500"
          />
          <StatsCard
            title="已合并"
            value={statsLoading ? '-' : String(stats?.merged ?? 0)}
            icon={GitMerge}
            color="text-blue-500"
          />
          <StatsCard
            title="未聚类人脸"
            value={faceStatsLoading ? '-' : String(unclusteredCount)}
            icon={AlertCircle}
            color={unclusteredCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}
          />
        </div>

        {/* 操作区域 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">聚类操作</CardTitle>
            <CardDescription>
              {unclusteredCount > 0
                ? `有 ${unclusteredCount} 张人脸尚未聚类`
                : '所有人脸已完成聚类'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={handleCluster}
              disabled={clusterMutation.isPending || unclusteredCount === 0}
            >
              {clusterMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              自动聚类
            </Button>
            <Button
              variant="outline"
              onClick={handleMergeSimilar}
              disabled={mergeSimilarMutation.isPending}
            >
              {mergeSimilarMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GitMerge className="mr-2 h-4 w-4" />
              )}
              合并相似聚类
            </Button>

            {selectedIds.size > 0 && (
              <>
                <div className="w-px h-8 bg-border mx-2" />
                <Badge variant="secondary" className="h-8 px-3">
                  已选择 {selectedIds.size}
                </Badge>
                {selectedIds.size >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMergeSelected}
                    disabled={mergeSelectedMutation.isPending}
                  >
                    {mergeSelectedMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GitMerge className="mr-2 h-4 w-4" />
                    )}
                    合并选中
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleConfirmSelected}>
                  <Check className="mr-2 h-4 w-4" />
                  确认选中
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  取消选择
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* 聚类列表 */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">待标注 ({stats?.pending ?? 0})</TabsTrigger>
            <TabsTrigger value="confirmed">已确认 ({stats?.confirmed ?? 0})</TabsTrigger>
            <TabsTrigger value="all">全部 ({stats?.total ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <ClusterGrid
              clusters={clusters?.filter((c) => c.status === 'pending')}
              isLoading={clustersLoading}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
              onConfirm={(id) => updateStatusMutation.mutate({ id, status: 'confirmed' })}
              onDelete={(id) => {
                setClusterToDelete(id)
                setDeleteDialogOpen(true)
              }}
            />
          </TabsContent>

          <TabsContent value="confirmed" className="mt-4">
            <ClusterGrid
              clusters={clusters?.filter((c) => c.status === 'confirmed')}
              isLoading={clustersLoading}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
              onDelete={(id) => {
                setClusterToDelete(id)
                setDeleteDialogOpen(true)
              }}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <ClusterGrid
              clusters={clusters}
              isLoading={clustersLoading}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
              onConfirm={(id) => updateStatusMutation.mutate({ id, status: 'confirmed' })}
              onDelete={(id) => {
                setClusterToDelete(id)
                setDeleteDialogOpen(true)
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除聚类后，其中的人脸将变为未聚类状态。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clusterToDelete && handleDeleteCluster(clusterToDelete)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function StatsCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

interface ClusterGridProps {
  clusters?: Array<{
    id: string
    faceCount: number | null
    status: string | null
    createdAt: Date | null
    representativeFaceId: string | null
    faces: Array<{ id: string; thumbnailPath: string | null }>
  }>
  isLoading: boolean
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onConfirm?: (id: string) => void
  onDelete: (id: string) => void
}

function ClusterGrid({
  clusters,
  isLoading,
  selectedIds,
  onSelect,
  onConfirm,
  onDelete,
}: ClusterGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!clusters || clusters.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
          暂无聚类数据
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clusters.map((cluster) => {
        const isSelected = selectedIds.has(cluster.id)
        const previewFaces = cluster.faces.slice(0, 4)
        const remainingCount = (cluster.faceCount ?? 0) - previewFaces.length

        return (
          <Card
            key={cluster.id}
            className={cn(
              'group relative cursor-pointer transition-all hover:shadow-md',
              isSelected && 'ring-2 ring-primary'
            )}
            onClick={() => onSelect(cluster.id)}
          >
            {/* 选中指示器 */}
            {isSelected && (
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
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onConfirm(cluster.id)
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    确认聚类
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(cluster.id)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <CardContent className="p-4">
              {/* 人脸预览网格 */}
              <Link
                href={`/clusters/${cluster.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-2 gap-1 aspect-square rounded-lg overflow-hidden bg-muted">
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

              {/* 聚类信息 */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cluster.faceCount ?? 0} 张</span>
                </div>
                <Badge
                  variant={
                    cluster.status === 'confirmed'
                      ? 'default'
                      : cluster.status === 'merged'
                      ? 'secondary'
                      : 'outline'
                  }
                  className={cn(
                    cluster.status === 'confirmed' && 'bg-green-500',
                    cluster.status === 'pending' && 'border-yellow-500 text-yellow-500'
                  )}
                >
                  {cluster.status === 'confirmed'
                    ? '已确认'
                    : cluster.status === 'merged'
                    ? '已合并'
                    : '待标注'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
