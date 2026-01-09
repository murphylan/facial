'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useIdentityWithFaces,
  useUpdateIdentity,
  useDeleteIdentity,
  useUnlinkCluster,
} from '@/hooks/use-identities'
import {
  ArrowLeft,
  Users,
  Pencil,
  Trash2,
  Save,
  X,
  User,
  Layers,
  Unlink,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function IdentityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: identity, isLoading } = useIdentityWithFaces(id)
  const updateMutation = useUpdateIdentity()
  const deleteMutation = useDeleteIdentity()
  const unlinkMutation = useUnlinkCluster()

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleStartEdit = () => {
    if (identity) {
      setEditName(identity.name)
      setEditDescription(identity.description ?? '')
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    if (!editName.trim()) return

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        },
      })
      toast.success('保存成功')
      setIsEditing(false)
    } catch {
      toast.error('保存失败')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('身份已删除')
      router.push('/identities')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleUnlinkCluster = async (clusterId: string) => {
    try {
      await unlinkMutation.mutateAsync({ identityId: id, clusterId })
      toast.success('已解除关联')
    } catch {
      toast.error('解除关联失败')
    }
  }

  if (isLoading) {
    return (
      <>
        <Header title="身份详情" />
        <div className="flex-1 p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24" />
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (!identity) {
    return (
      <>
        <Header title="身份详情" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
              身份不存在
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // 获取关联的聚类
  const linkedClusters = identity.identityClusters?.map((ic) => ic.cluster).filter(Boolean) ?? []

  return (
    <>
      <Header title="身份详情" />
      <div className="flex-1 space-y-6 p-6">
        {/* 返回按钮 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/identities">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        </div>

        {/* 身份信息 */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex items-center gap-4">
              {/* 头像 */}
              <Avatar className="h-20 w-20">
                <AvatarImage src={identity.avatarPath ?? undefined} alt={identity.name} />
                <AvatarFallback className="text-2xl">
                  {identity.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* 信息 */}
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="姓名"
                    className="font-semibold"
                  />
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="描述（可选）"
                  />
                </div>
              ) : (
                <div>
                  <CardTitle className="text-xl">{identity.name}</CardTitle>
                  {identity.description && (
                    <CardDescription className="mt-1">{identity.description}</CardDescription>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      <Layers className="mr-1 h-3 w-3" />
                      {linkedClusters.length} 个聚类
                    </Badge>
                    <Badge variant="outline">
                      <User className="mr-1 h-3 w-3" />
                      {identity.faces?.length ?? 0} 张人脸
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    保存
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleStartEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑
                  </Button>
                  <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* 关联的聚类 */}
        {linkedClusters.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>关联的聚类</CardTitle>
              <CardDescription>此身份关联了 {linkedClusters.length} 个聚类</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {linkedClusters.map((cluster) => (
                  <div
                    key={cluster!.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <Link
                      href={`/clusters/${cluster!.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Layers className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">聚类 #{cluster!.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {cluster!.faceCount} 张人脸
                        </p>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleUnlinkCluster(cluster!.id)}
                        >
                          <Unlink className="mr-2 h-4 w-4" />
                          解除关联
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 关联的人脸 */}
        <Card>
          <CardHeader>
            <CardTitle>关联的人脸</CardTitle>
            <CardDescription>共 {identity.faces?.length ?? 0} 张人脸</CardDescription>
          </CardHeader>
          <CardContent>
            {!identity.faces || identity.faces.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                <User className="h-10 w-10" />
                <p>暂无关联的人脸</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/annotate">
                    前往标注工作台
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {identity.faces.map((face) => (
                  <div
                    key={face.id}
                    className="group relative aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden"
                  >
                    {face.thumbnailPath ? (
                      <img
                        src={face.thumbnailPath}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除身份 "{identity.name}" 吗？关联的聚类将变为未标注状态。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
