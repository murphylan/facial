'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, User, Users, Trash2, Edit } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface IdentityCardData {
  id: string
  name: string
  description: string | null
  avatarPath: string | null
  createdAt: Date | null
  clusterCount?: number
  faceCount?: number
}

interface IdentityCardProps {
  identity: IdentityCardData
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

export function IdentityCard({
  identity,
  onEdit,
  onDelete,
  className,
}: IdentityCardProps) {
  return (
    <Card className={cn('group relative transition-all hover:shadow-md', className)}>
      {/* 菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/identities/${identity.id}`}>
              <User className="mr-2 h-4 w-4" />
              查看详情
            </Link>
          </DropdownMenuItem>
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(identity.id)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(identity.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Link href={`/identities/${identity.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={identity.avatarPath ?? undefined} alt={identity.name} />
              <AvatarFallback className="text-lg">
                {identity.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{identity.name}</h3>
              {identity.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {identity.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                {identity.clusterCount !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="mr-1 h-3 w-3" />
                    {identity.clusterCount} 聚类
                  </Badge>
                )}
                {identity.faceCount !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    {identity.faceCount} 张人脸
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
