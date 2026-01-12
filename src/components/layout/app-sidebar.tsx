'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Camera,
  Users,
  Layers,
  Tag,
  Upload,
  Activity,
  Settings,
  LayoutDashboard,
  ScanFace,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const navigationItems = [
  {
    title: '概览',
    items: [
      { title: '仪表盘', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: '数据采集',
    items: [
      { title: '上传管理', href: '/upload', icon: Upload },
      { title: '摄像头', href: '/camera', icon: Camera },
    ],
  },
  {
    title: '人脸管理',
    items: [
      { title: '聚类浏览', href: '/clusters', icon: Layers },
      { title: '标注工作台', href: '/annotate', icon: Tag },
      { title: '身份库', href: '/identities', icon: Users },
    ],
  },
  {
    title: '识别应用',
    items: [
      { title: '识别监控', href: '/recognition', icon: Activity },
    ],
  },
  {
    title: '系统',
    items: [
      { title: '设置', href: '/settings', icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanFace className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">人脸识别系统</span>
            <span className="text-xs text-muted-foreground">无感识别 · 智能聚类</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/' && pathname.startsWith(item.href))
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-4 py-3 text-xs text-muted-foreground">
          <p>Powered by Murphy</p>
          <p>© 2026 Facial Recognition</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
