'use client'

import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePendingClusters, useCluster } from '@/hooks/use-clusters'
import {
  useIdentities,
  useCreateIdentity,
  useLinkCluster,
  useCreateIdentityWithClusters,
} from '@/hooks/use-identities'
import {
  Users,
  Plus,
  Tag,
  ArrowRight,
  Search,
  CheckCircle,
  User,
  Loader2,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { IdentityFormDialog } from '@/components/identity'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

export default function AnnotatePage() {
  return (
    <Suspense fallback={<AnnotatePageSkeleton />}>
      <AnnotatePageContent />
    </Suspense>
  )
}

function AnnotatePageSkeleton() {
  return (
    <>
      <Header title="标注工作台" />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}

function AnnotatePageContent() {
  const searchParams = useSearchParams()
  const preselectedClusterId = searchParams.get('cluster')

  const { data: pendingClusters, isLoading: clustersLoading } = usePendingClusters()
  const { data: identities, isLoading: identitiesLoading } = useIdentities()
  const createIdentityMutation = useCreateIdentity()
  const linkClusterMutation = useLinkCluster()
  const createWithClustersMutation = useCreateIdentityWithClusters()

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [showNewIdentityDialog, setShowNewIdentityDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 预选聚类
  useEffect(() => {
    if (preselectedClusterId && pendingClusters?.some((c) => c.id === preselectedClusterId)) {
      setSelectedClusterId(preselectedClusterId)
    }
  }, [preselectedClusterId, pendingClusters])

  // 加载选中的聚类详情
  const { data: selectedClusterDetail } = useCluster(selectedClusterId ?? '')

  const handleLinkToIdentity = async (identityId: string) => {
    if (!selectedClusterId) return

    try {
      await linkClusterMutation.mutateAsync({
        identityId,
        clusterId: selectedClusterId,
      })
      const identity = identities?.find((i) => i.id === identityId)
      toast.success(`已关联到: ${identity?.name}`)
      setSelectedClusterId(null)
    } catch {
      toast.error('关联失败')
    }
  }

  const handleCreateAndLink = async (data: { name: string; description: string }) => {
    if (!selectedClusterId) return

    try {
      await createWithClustersMutation.mutateAsync({
        data: {
          name: data.name,
          description: data.description || undefined,
        },
        clusterIds: [selectedClusterId],
      })

      toast.success(`已创建身份并关联: ${data.name}`)
      setShowNewIdentityDialog(false)
      setSelectedClusterId(null)
    } catch {
      toast.error('操作失败')
    }
  }

  // 过滤身份
  const filteredIdentities = identities?.filter((identity) =>
    identity.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pendingCount = pendingClusters?.length ?? 0

  return (
    <>
      <Header title="标注工作台" />
      <div className="flex-1 p-6">
        {/* 统计信息 */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Layers className="mr-2 h-4 w-4" />
              待标注: {pendingCount}
            </Badge>
            {pendingCount === 0 && (
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                所有聚类已标注
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 待标注聚类列表 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                待标注聚类
              </CardTitle>
              <CardDescription>选择一个聚类进行标注</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {clustersLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : !pendingClusters || pendingClusters.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground p-4">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <p>所有聚类已完成标注</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="p-4 space-y-2">
                    {pendingClusters.map((cluster) => {
                      const isSelected = selectedClusterId === cluster.id
                      return (
                        <div
                          key={cluster.id}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => setSelectedClusterId(cluster.id)}
                        >
                          {/* 人脸预览 */}
                          <div className="grid grid-cols-2 gap-0.5 w-12 h-12 rounded overflow-hidden">
                            {cluster.faces.slice(0, 4).map((face) => (
                              <div
                                key={face.id}
                                className="aspect-square bg-muted flex items-center justify-center overflow-hidden"
                              >
                                {face.thumbnailPath ? (
                                  <img
                                    src={face.thumbnailPath}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <User className="h-2 w-2 text-muted-foreground" />
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              聚类 #{cluster.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cluster.faceCount ?? cluster.faces.length} 张人脸
                            </p>
                          </div>

                          <ChevronRight
                            className={cn(
                              'h-4 w-4 transition-colors',
                              isSelected ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* 聚类详情预览 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                聚类预览
              </CardTitle>
              <CardDescription>
                {selectedClusterId ? '查看选中聚类的人脸' : '请先选择一个聚类'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedClusterId ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <p>← 请选择左侧的聚类</p>
                </div>
              ) : !selectedClusterDetail ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {selectedClusterDetail.faces?.slice(0, 9).map((face) => (
                      <div
                        key={face.id}
                        className="aspect-square rounded-lg border bg-muted overflow-hidden"
                      >
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
                      </div>
                    ))}
                  </div>
                  {(selectedClusterDetail.faces?.length ?? 0) > 9 && (
                    <p className="text-sm text-muted-foreground text-center">
                      还有 {(selectedClusterDetail.faces?.length ?? 0) - 9} 张人脸...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 身份选择 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                分配身份
              </CardTitle>
              <CardDescription>
                {selectedClusterId ? '选择或创建身份' : '请先选择一个聚类'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedClusterId ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <p>请先选择一个聚类</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 创建新身份按钮 */}
                  <Button
                    className="w-full"
                    onClick={() => setShowNewIdentityDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    创建新身份并关联
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        或选择现有身份
                      </span>
                    </div>
                  </div>

                  {/* 搜索框 */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="搜索身份..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* 身份列表 */}
                  {identitiesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : !filteredIdentities || filteredIdentities.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-4">
                      {searchQuery ? '没有找到匹配的身份' : '暂无身份，请创建'}
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {filteredIdentities.map((identity) => (
                          <div
                            key={identity.id}
                            className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleLinkToIdentity(identity.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={identity.avatarPath ?? undefined} />
                                <AvatarFallback>
                                  {identity.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{identity.name}</p>
                                {identity.description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                    {identity.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {linkClusterMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 创建身份对话框 */}
      <IdentityFormDialog
        open={showNewIdentityDialog}
        onOpenChange={setShowNewIdentityDialog}
        onSubmit={handleCreateAndLink}
        title="创建新身份"
        description="为选中的聚类创建一个新的身份"
        submitLabel="创建并关联"
        isLoading={createWithClustersMutation.isPending}
      />
    </>
  )
}
