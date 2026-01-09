'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useRecognitionLogs,
  useRecognitionStats,
  useDeleteRecognitionLog,
  useClearOldLogs,
} from '@/hooks/use-recognition'
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
  Trash2,
  RefreshCw,
  User,
  Loader2,
  MoreHorizontal,
  Camera,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
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
import Link from 'next/link'

type TimeRange = '1h' | '24h' | '7d' | '30d'
type FilterType = 'all' | 'identified' | 'strangers'

export default function RecognitionPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const getSinceDate = (range: TimeRange) => {
    const now = Date.now()
    switch (range) {
      case '1h':
        return new Date(now - 60 * 60 * 1000)
      case '24h':
        return new Date(now - 24 * 60 * 60 * 1000)
      case '7d':
        return new Date(now - 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now - 30 * 24 * 60 * 60 * 1000)
    }
  }

  const since = getSinceDate(timeRange)

  const { data: logs, isLoading: logsLoading, refetch } = useRecognitionLogs({
    since,
    isStranger: filterType === 'all' ? undefined : filterType === 'strangers',
    limit: 100,
  })

  const { data: stats, isLoading: statsLoading } = useRecognitionStats({ since })
  const deleteMutation = useDeleteRecognitionLog()
  const clearMutation = useClearOldLogs()

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('记录已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleClearOld = async () => {
    try {
      await clearMutation.mutateAsync(30)
      toast.success('已清理 30 天前的记录')
      setClearDialogOpen(false)
    } catch {
      toast.error('清理失败')
    }
  }

  const timeRangeLabel = {
    '1h': '最近 1 小时',
    '24h': '最近 24 小时',
    '7d': '最近 7 天',
    '30d': '最近 30 天',
  }

  return (
    <>
      <Header title="识别监控" />
      <div className="flex-1 space-y-6 p-6">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title={`${timeRangeLabel[timeRange]}识别`}
            value={statsLoading ? '-' : String(stats?.total ?? 0)}
            icon={Activity}
            color="text-primary"
          />
          <StatsCard
            title="已识别"
            value={statsLoading ? '-' : String(stats?.identified ?? 0)}
            icon={CheckCircle}
            color="text-green-500"
            subtitle={
              stats?.total
                ? `${((Number(stats.identified) / Number(stats.total)) * 100).toFixed(0)}%`
                : undefined
            }
          />
          <StatsCard
            title="陌生人"
            value={statsLoading ? '-' : String(stats?.strangers ?? 0)}
            icon={AlertTriangle}
            color="text-yellow-500"
            subtitle={
              stats?.total
                ? `${((Number(stats.strangers) / Number(stats.total)) * 100).toFixed(0)}%`
                : undefined
            }
          />
        </div>

        {/* 筛选和操作 */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">时间范围:</span>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">最近 1 小时</SelectItem>
                  <SelectItem value="24h">最近 24 小时</SelectItem>
                  <SelectItem value="7d">最近 7 天</SelectItem>
                  <SelectItem value="30d">最近 30 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">类型:</span>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="identified">已识别</SelectItem>
                  <SelectItem value="strangers">陌生人</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清理旧记录
            </Button>
          </CardContent>
        </Card>

        {/* 识别记录 */}
        <Card>
          <CardHeader>
            <CardTitle>识别记录</CardTitle>
            <CardDescription>
              共 {logs?.length ?? 0} 条记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {logsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : !logs || logs.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Activity className="h-10 w-10" />
                  <p>暂无识别记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <RecognitionLogItem
                      key={log.id}
                      log={log}
                      onDelete={() => handleDelete(log.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 清理确认对话框 */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清理旧记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 30 天前的所有识别记录吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearOld}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认清理
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
  subtitle,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: string
  subtitle?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

function RecognitionLogItem({
  log,
  onDelete,
}: {
  log: {
    id: string
    isStranger: boolean | null
    confidence: number | null
    timestamp: Date | null
    thumbnailPath: string | null
    identity: { id: string; name: string; avatarPath: string | null } | null
    camera: { id: string; name: string } | null
  }
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50">
      {/* 缩略图 */}
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted overflow-hidden">
        {log.thumbnailPath ? (
          <img
            src={log.thumbnailPath}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <User className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {log.isStranger ? (
            <>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">陌生人</span>
            </>
          ) : log.identity ? (
            <Link
              href={`/identities/${log.identity.id}`}
              className="flex items-center gap-2 hover:underline"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={log.identity.avatarPath ?? undefined} />
                <AvatarFallback className="text-xs">
                  {log.identity.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{log.identity.name}</span>
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground">未知</span>
          )}

          {log.confidence && (
            <Badge
              variant="secondary"
              className={
                log.confidence >= 0.8
                  ? 'bg-green-100 text-green-700'
                  : log.confidence >= 0.6
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }
            >
              {(log.confidence * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          {log.camera && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {log.camera.name}
            </span>
          )}
          {log.timestamp && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(log.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* 操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {log.identity && (
            <DropdownMenuItem asChild>
              <Link href={`/identities/${log.identity.id}`}>
                <User className="mr-2 h-4 w-4" />
                查看身份
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除记录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
