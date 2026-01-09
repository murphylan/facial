'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  Layers,
  Camera,
  Activity,
  Upload,
  Tag,
  Clock,
  User,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import {
  useDashboardStats,
  useRecentActivity,
  useHourlyStats,
  useTopIdentities,
} from '@/hooks/use-stats'
import { formatRelativeTime } from '@/lib/utils'

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: activities, isLoading: activitiesLoading } = useRecentActivity(10)
  const { data: hourlyStats, isLoading: hourlyLoading } = useHourlyStats()
  const { data: topIdentities, isLoading: topLoading } = useTopIdentities(5)

  return (
    <>
      <Header title="仪表盘" />
      <div className="flex-1 space-y-6 p-6">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="已识别身份"
            value={statsLoading ? undefined : stats?.identitiesCount}
            description="已标注的人员数量"
            icon={Users}
            href="/identities"
          />
          <StatsCard
            title="待标注聚类"
            value={statsLoading ? undefined : stats?.pendingClustersCount}
            description="需要人工标注"
            icon={Layers}
            href="/clusters"
            highlight={Boolean(stats?.pendingClustersCount && stats.pendingClustersCount > 0)}
          />
          <StatsCard
            title="今日识别"
            value={statsLoading ? undefined : stats?.todayRecognitionsCount}
            description="今日识别次数"
            icon={Activity}
            href="/recognition"
          />
          <StatsCard
            title="在线摄像头"
            value={statsLoading ? undefined : stats?.onlineCamerasCount}
            description="当前在线数量"
            icon={Camera}
            href="/camera"
          />
        </div>

        {/* 图表和排行 */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 24小时识别趋势 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                24 小时识别趋势
              </CardTitle>
              <CardDescription>过去 24 小时的识别数据</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : !hourlyStats || hourlyStats.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  暂无数据
                </div>
              ) : (
                <div className="h-48">
                  <HourlyChart data={hourlyStats} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 热门身份 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                热门身份
              </CardTitle>
              <CardDescription>识别次数最多</CardDescription>
            </CardHeader>
            <CardContent>
              {topLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !topIdentities || topIdentities.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  暂无数据
                </div>
              ) : (
                <div className="space-y-3">
                  {topIdentities.map((identity, index) => (
                    <Link
                      key={identity.id}
                      href={`/identities/${identity.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={identity.avatarPath ?? undefined} />
                          <AvatarFallback>
                            {identity.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {index + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{identity.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {identity.recognitionCount} 次识别
                        </p>
                      </div>
                      {identity.lastSeen && (
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(identity.lastSeen)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 数据概览和快捷操作 */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 数据概览 */}
          <Card>
            <CardHeader>
              <CardTitle>数据概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataOverviewItem
                label="人脸数据"
                total={stats?.totalFacesCount ?? 0}
                current={stats?.unclusteredFacesCount ?? 0}
                description={`${stats?.unclusteredFacesCount ?? 0} 张未聚类`}
                isLoading={statsLoading}
              />
              <DataOverviewItem
                label="聚类进度"
                total={stats?.totalFacesCount ?? 0}
                current={(stats?.totalFacesCount ?? 0) - (stats?.unclusteredFacesCount ?? 0)}
                description={`${stats?.pendingClustersCount ?? 0} 个待标注`}
                isLoading={statsLoading}
              />
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickActionItem
                title="上传图片"
                description="批量上传图片进行人脸检测"
                href="/upload"
                icon={Upload}
              />
              <QuickActionItem
                title="实时摄像头"
                description="开启摄像头进行实时人脸检测"
                href="/camera"
                icon={Camera}
              />
              <QuickActionItem
                title="开始标注"
                description="为检测到的人脸分配身份"
                href="/annotate"
                icon={Tag}
                badge={
                  stats?.pendingClustersCount && stats.pendingClustersCount > 0
                    ? `${stats.pendingClustersCount} 待处理`
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </div>

        {/* 最近活动 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>最近活动</CardTitle>
              <CardDescription>系统最近的识别记录</CardDescription>
            </div>
            <Link href="/recognition" className="text-sm text-primary hover:underline">
              查看全部 →
            </Link>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !activities || activities.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Activity className="h-8 w-8" />
                <p>暂无识别记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        activity.title.includes('陌生人')
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-green-500/10 text-green-500'
                      }`}
                    >
                      {activity.title.includes('陌生人') ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(activity.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  href,
  highlight,
}: {
  title: string
  value?: number
  description: string
  icon: React.ElementType
  href: string
  highlight?: boolean
}) {
  return (
    <Link href={href}>
      <Card
        className={`transition-colors hover:bg-muted/50 cursor-pointer ${
          highlight ? 'border-yellow-500/50 bg-yellow-500/5' : ''
        }`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon
            className={`h-4 w-4 ${highlight ? 'text-yellow-500' : 'text-muted-foreground'}`}
          />
        </CardHeader>
        <CardContent>
          {value === undefined ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className={`text-2xl font-bold ${highlight ? 'text-yellow-500' : ''}`}>
              {value}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function QuickActionItem({
  title,
  description,
  href,
  icon: Icon,
  badge,
}: {
  title: string
  description: string
  href: string
  icon: React.ElementType
  badge?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}

function DataOverviewItem({
  label,
  total,
  current,
  description,
  isLoading,
}: {
  label: string
  total: number
  current: number
  description: string
  isLoading: boolean
}) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="text-sm text-muted-foreground">{description}</span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-2 w-full" />
      ) : (
        <Progress value={percentage} className="h-2" />
      )}
    </div>
  )
}

function HourlyChart({ data }: { data: { hour: number; count: number; identified: number; strangers: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="h-full flex items-end justify-between gap-1">
      {data.map((item, index) => {
        const height = (item.count / maxCount) * 100
        const identifiedHeight = (item.identified / maxCount) * 100
        const strangersHeight = (item.strangers / maxCount) * 100

        return (
          <div
            key={index}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${item.hour}:00 - 共 ${item.count} 次 (已识别: ${item.identified}, 陌生人: ${item.strangers})`}
          >
            <div className="w-full flex flex-col justify-end h-36">
              {item.count > 0 ? (
                <div className="w-full flex flex-col">
                  {item.strangers > 0 && (
                    <div
                      className="w-full bg-yellow-400 rounded-t"
                      style={{ height: `${strangersHeight}%`, minHeight: item.strangers > 0 ? 4 : 0 }}
                    />
                  )}
                  {item.identified > 0 && (
                    <div
                      className="w-full bg-green-500"
                      style={{ height: `${identifiedHeight}%`, minHeight: item.identified > 0 ? 4 : 0 }}
                    />
                  )}
                </div>
              ) : (
                <div className="w-full h-1 bg-muted rounded" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {item.hour}
            </span>
          </div>
        )
      })}
    </div>
  )
}
