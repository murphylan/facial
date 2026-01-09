'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCluster,
  useDeleteCluster,
  useUpdateClusterStatus,
  useSetRepresentativeFace,
  useRemoveFaceFromCluster,
  useClusters,
  useMoveFacesToCluster,
} from '@/hooks/use-clusters'
import {
  ArrowLeft,
  Trash2,
  CheckCircle,
  Users,
  Tag,
  Star,
  User,
  MoreHorizontal,
  Move,
  ZoomIn,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { ScrollArea } from '@/components/ui/scroll-area'

interface FaceData {
  id: string
  thumbnailPath: string | null
  age: number | null
  gender: string | null
  emotion: string | null
  qualityScore: number | null
  createdAt: Date | null
}

export default function ClusterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewFace, setPreviewFace] = useState<FaceData | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [targetClusterId, setTargetClusterId] = useState<string>('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: cluster, isLoading } = useCluster(id)
  const { data: allClusters } = useClusters()
  const deleteMutation = useDeleteCluster()
  const updateStatusMutation = useUpdateClusterStatus()
  const setRepresentativeMutation = useSetRepresentativeFace()
  const removeFaceMutation = useRemoveFaceFromCluster()
  const moveFacesMutation = useMoveFacesToCluster()

  const toggleSelect = useCallback((faceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(faceId)) {
        next.delete(faceId)
      } else {
        next.add(faceId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (cluster?.faces) {
      setSelectedIds(new Set(cluster.faces.map((f) => f.id)))
    }
  }, [cluster?.faces])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('聚类已删除')
      router.push('/clusters')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleConfirm = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: 'confirmed' })
      toast.success('聚类已确认')
    } catch {
      toast.error('操作失败')
    }
  }

  const handleSetRepresentative = async (faceId: string) => {
    try {
      await setRepresentativeMutation.mutateAsync({ clusterId: id, faceId })
      toast.success('已设为代表人脸')
    } catch {
      toast.error('操作失败')
    }
  }

  const handleRemoveFace = async (faceId: string) => {
    try {
      await removeFaceMutation.mutateAsync(faceId)
      toast.success('人脸已移除')
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(faceId)
        return next
      })
    } catch {
      toast.error('移除失败')
    }
  }

  const handleMoveSelected = async () => {
    if (!targetClusterId || selectedIds.size === 0) return

    try {
      await moveFacesMutation.mutateAsync({
        faceIds: Array.from(selectedIds),
        targetClusterId,
      })
      toast.success(`已移动 ${selectedIds.size} 张人脸`)
      clearSelection()
      setMoveDialogOpen(false)
      setTargetClusterId('')
    } catch {
      toast.error('移动失败')
    }
  }

  if (isLoading) {
    return (
      <>
        <Header title="聚类详情" />
        <div className="flex-1 p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (!cluster) {
    return (
      <>
        <Header title="聚类详情" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
              聚类不存在
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const linkedIdentity = cluster.identityClusters?.[0]?.identity
  const otherClusters = allClusters?.filter((c) => c.id !== id && c.status !== 'merged') ?? []

  return (
    <>
      <Header title="聚类详情" />
      <div className="flex-1 space-y-6 p-6">
        {/* 返回按钮 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clusters">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        </div>

        {/* 聚类信息 */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                聚类 #{id.slice(0, 8)}
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
              </CardTitle>
              <CardDescription>
                包含 {cluster.faceCount ?? cluster.faces?.length ?? 0} 张人脸
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {cluster.status === 'pending' && (
                <>
                  <Button onClick={handleConfirm} disabled={updateStatusMutation.isPending}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    确认聚类
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/annotate?cluster=${id}`}>
                      <Tag className="mr-2 h-4 w-4" />
                      分配身份
                    </Link>
                  </Button>
                </>
              )}
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* 已关联身份 */}
            {linkedIdentity && (
              <div className="mb-6 rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">已关联身份</p>
                <Link
                  href={`/identities/${linkedIdentity.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{linkedIdentity.name}</span>
                </Link>
              </div>
            )}

            {/* 选中操作栏 */}
            {cluster.faces && cluster.faces.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    已选择 {selectedIds.size} / {cluster.faces.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    全选
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      取消选择
                    </Button>
                  )}
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMoveDialogOpen(true)}
                    >
                      <Move className="mr-2 h-4 w-4" />
                      移动到其他聚类
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 人脸网格 */}
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {cluster.faces?.map((face) => {
                const isSelected = selectedIds.has(face.id)
                const isRepresentative = face.id === cluster.representativeFaceId

                return (
                  <div
                    key={face.id}
                    className={cn(
                      'group relative aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden cursor-pointer transition-all',
                      isSelected && 'ring-2 ring-primary',
                      isRepresentative && 'ring-2 ring-yellow-500'
                    )}
                    onClick={() => toggleSelect(face.id)}
                  >
                    {/* 代表标记 */}
                    {isRepresentative && (
                      <Badge
                        className="absolute top-1 left-1 z-10 bg-yellow-500 text-white"
                        variant="secondary"
                      >
                        <Star className="h-3 w-3" />
                      </Badge>
                    )}

                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <CheckCircle className="h-3 w-3" />
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
                        <DropdownMenuItem onClick={() => setPreviewFace(face)}>
                          <ZoomIn className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        {!isRepresentative && (
                          <DropdownMenuItem onClick={() => handleSetRepresentative(face.id)}>
                            <Star className="mr-2 h-4 w-4" />
                            设为代表
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemoveFace(face.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          从聚类移除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 图片 */}
                    {face.thumbnailPath ? (
                      <img
                        src={face.thumbnailPath}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground" />
                    )}

                    {/* 悬浮信息 */}
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
                  </div>
                )
              })}
            </div>

            {(!cluster.faces || cluster.faces.length === 0) && (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                暂无人脸数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 人脸详情对话框 */}
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

      {/* 移动人脸对话框 */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动人脸</DialogTitle>
            <DialogDescription>
              将选中的 {selectedIds.size} 张人脸移动到其他聚类
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={targetClusterId} onValueChange={setTargetClusterId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标聚类" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="max-h-60">
                  {otherClusters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      聚类 #{c.id.slice(0, 8)} ({c.faceCount} 张人脸)
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleMoveSelected}
              disabled={!targetClusterId || moveFacesMutation.isPending}
            >
              {moveFacesMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Move className="mr-2 h-4 w-4" />
              )}
              移动
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
