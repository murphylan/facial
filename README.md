# 无感人脸识别系统

## 🚀 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 启动数据库 (需要 Podman)
podman run -d \
  --name facial-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=facial \
  -p 5433:5432 \
  pgvector/pgvector:0.8.1-pg18-trixie

# 3. 启用 vector 扩展
podman exec -it facial-postgres psql -U postgres -d facial -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. 配置环境变量
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5433/facial"' > .env.local

# 5. 推送数据库 schema
pnpm db:push

# 6. 启动开发服务器
pnpm dev
```

> ⚠️ 需要 Node.js >= 20.9.0 (推荐使用 nvm 管理版本)

---

## 🎯 核心理念

**无监督学习 + 人工后标注** 的流程：

```
摄像头/图片输入 → 人脸检测 → 特征提取 → 聚类分组 → 人工标注 → 识别应用
```

---

## 📦 项目配置

### 环境信息

| 配置项 | 值 |
|-------|-----|
| 部署方式 | 本地开发 → Podman 容器化部署 |
| 数据规模 | ≤100 人 |
| 数据库 | PostgreSQL 18 + pgvector 0.8.1 |
| AI 方案 | Node.js 原生库 (无 Python 依赖) |
| 摄像头 | 单摄像头 → 多摄像头扩展 |

### 数据库连接

```bash
# .env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/facial"
```

### 数据库容器

```bash
# 启动 pgvector 容器
podman run -d \
  --name facial-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=facial \
  -p 5433:5432 \
  pgvector/pgvector:0.8.1-pg18-trixie

# 启用 vector 扩展
podman exec -it facial-postgres psql -U postgres -d facial -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 推送数据库 schema
pnpm db:push
```

### 技术栈

| 类别 | 技术 |
|-----|------|
| Framework | Next.js 16 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| State | Zustand |
| Data Fetching | TanStack Query |
| Tables | TanStack Table + Dice UI |
| ORM | Drizzle |
| AI/ML | @vladmandic/human (Node.js) |

---

## 📋 功能需求梳理

### 1. 数据采集模块
| 功能 | 描述 |
|------|------|
| 图片/视频上传 | 支持批量上传图片或视频文件 |
| 实时摄像头接入 | WebRTC 接入本地/远程摄像头 |
| 帧抽取 | 从视频中按策略抽取关键帧 |

### 2. 人脸处理模块
| 功能 | 描述 |
|------|------|
| 人脸检测 | 从图片中检测所有人脸区域 |
| 人脸对齐 | 标准化人脸角度和大小 |
| 特征提取 | 生成人脸特征向量 (embedding) |
| 质量评估 | 过滤模糊、遮挡、角度过大的人脸 |

### 3. 无监督聚类模块
| 功能 | 描述 |
|------|------|
| 自动聚类 | 将相似人脸自动分组 (同一人) |
| 增量聚类 | 新数据自动归入现有类或创建新类 |
| 聚类调整 | 支持合并/拆分聚类结果 |

### 4. 人工标注模块
| 功能 | 描述 |
|------|------|
| 聚类审核 | 查看聚类结果，确认是否同一人 |
| 身份绑定 | 为聚类分配真实身份信息 |
| 错误修正 | 将错误归类的人脸移动到正确组 |
| 批量操作 | 支持批量确认、合并、删除 |

### 5. 识别应用模块
| 功能 | 描述 |
|------|------|
| 实时识别 | 新人脸与已标注库匹配 (视频流) |
| 相似度阈值 | 可配置的匹配阈值 |
| 识别记录 | 记录所有识别事件 |
| 陌生人告警 | 未匹配到已知身份时告警 |

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 16)                        │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   上传管理   │  聚类浏览   │  标注工作台  │  识别监控   │  设置   │
│  (Client)   │  (Server)  │  (Client)   │  (Client)   │(Client) │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────┘
        │                         │                   │
        │                         │                   ▼
        │                         │         ┌─────────────────┐
        │                         │         │  WebRTC Camera  │
        │                         │         │  (本地/远程)     │
        │                         │         └─────────────────┘
        ▼                         ▼                   │
┌─────────────────────────────────────────────────────────────────┐
│                  hooks/ (React Query Hooks)                      │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │  useQuery (查询)            │ │  useMutation (增删改)       ││
│  │  • 数据获取                 │ │  • 调用 Server Actions      ││
│  │  • 缓存管理                 │ │  • 乐观更新                 ││
│  │  • 后台刷新                 │ │  • 自动失效重新获取         ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server Actions Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ actions/    │ │ actions/    │ │ actions/    │ │ actions/   │ │
│  │ upload.ts   │ │ cluster.ts  │ │ annotate.ts │ │ identity.ts│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
            ┌───────────────┐          ┌────────────────────┐
            │   Drizzle     │          │  @vladmandic/human │
            │     ORM       │          │   (Node.js AI库)    │
            └───────────────┘          │  • 人脸检测         │
                    │                  │  • 特征提取         │
                    ▼                  │  • 表情/年龄/性别   │
            ┌───────────────┐          └────────────────────┘
            │ PostgreSQL 17 │
            │  + pgvector   │
            │ (Podman 容器)  │
            └───────────────┘
```

---

## 🎥 摄像头方案

### Phase 1: 本地摄像头
```typescript
// 使用浏览器 MediaDevices API
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720, facingMode: 'user' }
})
```

### Phase 2: 手机摄像头 (远程)
- 方案 A: 手机浏览器直接访问 (同一局域网)
- 方案 B: WebRTC P2P 连接
- 方案 C: IP Camera 流 (RTSP → WebRTC 转换)

### Phase 3: 多摄像头管理
```typescript
// 摄像头注册表
interface CameraSource {
  id: string
  name: string
  type: 'local' | 'remote' | 'ip'
  streamUrl?: string
  status: 'online' | 'offline'
}
```

---

## 🤖 AI 技术方案 (Node.js)

### 核心库: @vladmandic/human

> 纯 JavaScript/TypeScript 实现，无需 Python 依赖，支持 Node.js 和浏览器

```bash
pnpm add @vladmandic/human
```

| 功能 | 说明 |
|------|------|
| 人脸检测 | BlazeFace / MediaPipe Face |
| 特征提取 | FaceRes / MobileFaceNet (128/512维向量) |
| 活体检测 | 眨眼、点头等动作检测 |
| 表情识别 | 7种基本表情 |
| 年龄/性别 | 辅助信息 |

### 服务端使用示例
```typescript
// lib/human.ts
import Human from '@vladmandic/human'

const human = new Human({
  modelBasePath: 'file://models/',
  face: {
    enabled: true,
    detector: { rotation: true },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true }, // 特征向量
    emotion: { enabled: true },
  },
})

await human.load()

export async function detectFaces(imageBuffer: Buffer) {
  const tensor = human.tf.node.decodeImage(imageBuffer)
  const result = await human.detect(tensor)
  human.tf.dispose(tensor)
  
  return result.face.map(face => ({
    bbox: face.box,
    embedding: face.embedding, // 512维特征向量
    age: face.age,
    gender: face.gender,
    emotion: face.emotion,
  }))
}
```

### 聚类算法 (纯 JS 实现)

```typescript
// lib/clustering.ts
import { cosineDistance } from './utils'

// 简单的层次聚类 (适合 <100 人规模)
export function clusterFaces(
  embeddings: number[][],
  threshold: number = 0.5
): number[] {
  // DBSCAN 或层次聚类实现
  // 对于 100 人以内的规模，简单实现即可
}

// 相似度计算
export function compareEmbeddings(a: number[], b: number[]): number {
  return 1 - cosineDistance(a, b)
}
```

### 备选库

| 库 | 特点 |
|---|------|
| `@vladmandic/human` | ⭐ 推荐，功能全面，纯 JS |
| `face-api.js` | 经典库，但已停止维护 |
| `@mediapipe/face_mesh` | Google 官方，精度高 |
| `ml5.js` | 简单易用，适合原型 |

---

## ⚠️ 开发规范 (重要)

### 1. Server Actions 优先原则

**所有数据操作必须通过 Server Actions 实现，禁止使用传统 API Routes**

```typescript
// ✅ 正确: 使用 Server Action
// app/actions/cluster.ts
'use server'

export async function mergeClusters(clusterIds: string[]) {
  // 直接访问数据库
  return await db.update(clusters)...
}

// ❌ 错误: 使用 API Route
// app/api/clusters/merge/route.ts
export async function POST(req: Request) { ... }
```

### 2. Hooks 调用规范

**客户端组件必须通过 React Query Hooks 调用 Server Actions**

| 操作类型 | 必须使用 | 禁止使用 |
|---------|---------|---------|
| 查询 (GET) | `useQuery` | 自定义 fetch |
| 创建 (CREATE) | `useMutation` | 自定义 async 函数 |
| 更新 (UPDATE) | `useMutation` | 自定义 async 函数 |
| 删除 (DELETE) | `useMutation` | 自定义 async 函数 |

### 3. 代码示例

#### Server Action 定义
```typescript
// app/actions/identity.ts
'use server'

import { db } from '@/db'
import { identities } from '@/db/schema'
import { revalidatePath } from 'next/cache'

// 查询操作 - 供 useQuery 使用
export async function getIdentities() {
  return await db.select().from(identities)
}

export async function getIdentityById(id: string) {
  return await db.query.identities.findFirst({
    where: eq(identities.id, id)
  })
}

// 变更操作 - 供 useMutation 使用
export async function createIdentity(data: CreateIdentityInput) {
  const result = await db.insert(identities).values(data).returning()
  revalidatePath('/identities')
  return result[0]
}

export async function updateIdentity(id: string, data: UpdateIdentityInput) {
  const result = await db.update(identities)
    .set(data)
    .where(eq(identities.id, id))
    .returning()
  revalidatePath('/identities')
  return result[0]
}

export async function deleteIdentity(id: string) {
  await db.delete(identities).where(eq(identities.id, id))
  revalidatePath('/identities')
}
```

#### React Query Hooks
```typescript
// hooks/use-identities.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getIdentities, 
  getIdentityById,
  createIdentity, 
  updateIdentity, 
  deleteIdentity 
} from '@/app/actions/identity'

// ✅ 查询 Hook - useQuery
export function useIdentities() {
  return useQuery({
    queryKey: ['identities'],
    queryFn: () => getIdentities(),
  })
}

export function useIdentity(id: string) {
  return useQuery({
    queryKey: ['identities', id],
    queryFn: () => getIdentityById(id),
    enabled: !!id,
  })
}

// ✅ 创建 Hook - useMutation
export function useCreateIdentity() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createIdentity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
  })
}

// ✅ 更新 Hook - useMutation
export function useUpdateIdentity() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIdentityInput }) => 
      updateIdentity(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      queryClient.invalidateQueries({ queryKey: ['identities', id] })
    },
  })
}

// ✅ 删除 Hook - useMutation
export function useDeleteIdentity() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteIdentity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
  })
}
```

#### 客户端组件使用
```typescript
// components/identity-form.tsx
'use client'

import { useCreateIdentity, useUpdateIdentity } from '@/hooks/use-identities'

export function IdentityForm({ identity }: Props) {
  const createMutation = useCreateIdentity()
  const updateMutation = useUpdateIdentity()

  const handleSubmit = (data: FormData) => {
    if (identity) {
      updateMutation.mutate({ id: identity.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit}>
      {/* 表单内容 */}
      <Button disabled={isPending}>
        {isPending ? '保存中...' : '保存'}
      </Button>
    </form>
  )
}
```

---

## 📁 目录结构

```
src/
├── app/
│   ├── actions/                    # Server Actions (所有数据操作)
│   │   ├── camera.ts              # 摄像头管理
│   │   ├── cluster.ts             # 聚类管理
│   │   ├── clustering.ts          # 聚类算法调用
│   │   ├── detect.ts              # 人脸检测
│   │   ├── face.ts                # 人脸 CRUD
│   │   ├── identity.ts            # 身份管理
│   │   ├── recognition.ts         # 实时识别
│   │   ├── stats.ts               # 仪表盘统计
│   │   └── upload.ts              # 图片上传处理
│   ├── (dashboard)/               # 页面路由组
│   │   ├── page.tsx               # 仪表盘首页
│   │   ├── annotate/              # 标注工作台
│   │   ├── camera/                # 实时摄像头
│   │   ├── clusters/              # 聚类浏览
│   │   │   └── [id]/              # 聚类详情
│   │   ├── identities/            # 身份管理
│   │   │   └── [id]/              # 身份详情
│   │   ├── recognition/           # 识别监控
│   │   ├── settings/              # 系统设置
│   │   ├── upload/                # 数据上传
│   │   └── layout.tsx             # 仪表盘布局
│   ├── layout.tsx                 # 根布局
│   ├── providers.tsx              # React Query Provider
│   └── globals.css                # 全局样式
│
├── components/
│   ├── ui/                        # shadcn/ui 组件
│   ├── layout/                    # 布局组件
│   │   ├── app-sidebar.tsx        # 侧边栏导航
│   │   └── header.tsx             # 顶部栏
│   ├── camera/                    # 摄像头相关
│   │   ├── camera-feed.tsx        # 视频流显示
│   │   ├── camera-selector.tsx    # 摄像头选择器
│   │   └── face-overlay.tsx       # 人脸框叠加层
│   ├── cluster/                   # 聚类相关
│   │   ├── cluster-card.tsx       # 聚类卡片
│   │   ├── cluster-toolbar.tsx    # 聚类工具栏
│   │   └── face-grid.tsx          # 人脸网格
│   ├── identity/                  # 身份相关
│   │   ├── identity-card.tsx      # 身份卡片
│   │   ├── identity-form.tsx      # 身份表单
│   │   └── identity-selector.tsx  # 身份选择器
│   ├── recognition/               # 识别相关
│   │   ├── realtime-indicator.tsx # 实时状态指示
│   │   ├── recognition-badge.tsx  # 识别徽章
│   │   └── recognition-result.tsx # 识别结果展示
│   ├── annotation/                # 标注相关
│   └── upload/                    # 上传相关
│
├── hooks/                         # React Query Hooks
│   ├── use-cameras.ts             # 摄像头管理
│   ├── use-clusters.ts            # 聚类数据
│   ├── use-clustering.ts          # 聚类操作
│   ├── use-face-detection.ts      # 实时人脸检测
│   ├── use-faces.ts               # 人脸数据
│   ├── use-identities.ts          # 身份数据
│   ├── use-mobile.ts              # 移动端检测
│   ├── use-recognition.ts         # 识别功能
│   ├── use-stats.ts               # 统计数据
│   └── use-upload.ts              # 上传功能
│
├── stores/                        # Zustand Stores (仅客户端 UI 状态)
│   ├── camera-store.ts            # 摄像头状态、当前帧
│   ├── upload-store.ts            # 上传进度、队列
│   ├── annotation-store.ts        # 标注工作台 UI 状态
│   └── settings-store.ts          # 用户偏好设置
│
├── db/
│   ├── index.ts                   # Drizzle 客户端
│   ├── schema.ts                  # 表定义 (facial schema)
│   └── migrations/                # 迁移文件
│
└── lib/
    ├── human.ts                   # @vladmandic/human 封装
    ├── clustering.ts              # 聚类算法 (DBSCAN)
    ├── embedding.ts               # 向量操作 (余弦相似度)
    └── utils.ts                   # 工具函数
```

---

## 💾 数据库设计 (Drizzle Schema)

> 使用 `facial` schema 隔离表，避免与其他应用冲突

```typescript
// db/schema.ts
import { pgSchema, text, timestamp, jsonb, boolean, real, integer, index, vector } from 'drizzle-orm/pg-core'

// 定义自定义 schema
export const facialSchema = pgSchema('facial')

// 0. 摄像头源
export const cameras = facialSchema.table('cameras', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'local' | 'remote' | 'ip'
  streamUrl: text('stream_url'),
  status: text('status').default('offline'), // 'online' | 'offline'
  createdAt: timestamp('created_at').defaultNow(),
})

// 1. 原始图片/视频帧
export const images = facialSchema.table('images', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull(), // 'upload' | 'camera' | 'video'
  sourceId: text('source_id'), // camera_id 或 upload batch id
  filePath: text('file_path').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  processed: boolean('processed').default(false),
})

// 2. 检测到的人脸
export const faces = facialSchema.table('faces', {
  id: text('id').primaryKey(),
  imageId: text('image_id').references(() => images.id, { onDelete: 'cascade' }),
  bbox: jsonb('bbox').notNull(), // { x, y, width, height }
  qualityScore: real('quality_score'),
  embedding: vector('embedding', { dimensions: 512 }), // 512 维特征向量
  thumbnailPath: text('thumbnail_path'), // 人脸缩略图
  age: real('age'),
  gender: text('gender'), // 'male' | 'female' | 'unknown'
  emotion: text('emotion'),
  clusterId: text('cluster_id').references(() => clusters.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('faces_cluster_id_idx').on(table.clusterId),
  index('faces_image_id_idx').on(table.imageId),
])

// 3. 聚类 (未标注的分组)
export const clusters = facialSchema.table('clusters', {
  id: text('id').primaryKey(),
  faceCount: integer('face_count').default(0),
  representativeFaceId: text('representative_face_id'),
  centroid: vector('centroid', { dimensions: 512 }), // 聚类中心向量
  status: text('status').default('pending'), // 'pending' | 'confirmed' | 'merged'
  createdAt: timestamp('created_at').defaultNow(),
})

// 4. 已标注身份
export const identities = facialSchema.table('identities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  avatarPath: text('avatar_path'), // 代表照片
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 5. 身份-聚类关联 (一个身份可以对应多个聚类)
export const identityClusters = facialSchema.table('identity_clusters', {
  id: text('id').primaryKey(),
  identityId: text('identity_id').references(() => identities.id, { onDelete: 'cascade' }).notNull(),
  clusterId: text('cluster_id').references(() => clusters.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('identity_clusters_identity_idx').on(table.identityId),
  index('identity_clusters_cluster_idx').on(table.clusterId),
])

// 6. 识别记录
export const recognitionLogs = facialSchema.table('recognition_logs', {
  id: text('id').primaryKey(),
  faceId: text('face_id').references(() => faces.id, { onDelete: 'set null' }),
  matchedIdentityId: text('matched_identity_id').references(() => identities.id, { onDelete: 'set null' }),
  confidence: real('confidence'),
  cameraId: text('camera_id').references(() => cameras.id, { onDelete: 'set null' }),
  isStranger: boolean('is_stranger').default(false), // 是否为陌生人
  thumbnailPath: text('thumbnail_path'), // 识别时的截图
  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => [
  index('recognition_logs_identity_idx').on(table.matchedIdentityId),
  index('recognition_logs_timestamp_idx').on(table.timestamp),
])
```

### pgvector 初始化

```bash
# 启用 vector 扩展 (在 facial 数据库中)
podman exec -it facial-postgres psql -U postgres -d facial -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 使用 Drizzle 推送 schema
pnpm db:push
```

---

## 🔧 技术选型细节

### AI/ML 部分 (Node.js 原生)

| 任务 | 方案 | 说明 |
|------|------|------|
| 人脸检测 | @vladmandic/human | BlazeFace 模型 |
| 特征提取 | @vladmandic/human | 512维 embedding |
| 聚类算法 | 自实现 DBSCAN | 简单实现，100人够用 |
| 向量存储 | PostgreSQL + pgvector | 余弦相似度搜索 |
| 活体检测 | @vladmandic/human | 眨眼/点头检测 |

### 前端状态划分

| 状态类型 | 管理方案 | 说明 |
|---------|---------|------|
| 服务端数据 | React Query | 人脸、聚类、身份等业务数据 |
| 客户端 UI 状态 | Zustand | 弹窗、选中项、拖拽状态等 |
| 摄像头状态 | Zustand | 当前帧、检测结果 |
| URL 状态 | nuqs / searchParams | 筛选、分页、排序 |

### Zustand Store (仅客户端 UI 状态)
```typescript
// stores/camera-store.ts
interface CameraStore {
  isStreaming: boolean
  currentFrame: ImageData | null
  detectedFaces: DetectedFace[]
  selectedCameraId: string | null
  
  // Actions
  setStreaming: (value: boolean) => void
  updateFrame: (frame: ImageData) => void
  updateDetections: (faces: DetectedFace[]) => void
}

// stores/annotation-store.ts
interface AnnotationStore {
  selectedFaceIds: Set<string>
  dragState: DragState | null
  isCompareMode: boolean
  
  // Actions
  toggleFaceSelection: (id: string) => void
  clearSelection: () => void
  setDragState: (state: DragState | null) => void
}
```

---

## 📱 页面规划

```
/                       # 仪表盘 - 统计概览
/upload                 # 数据上传 - 拖拽上传、批量管理
/camera                 # 实时摄像头 - 预览、采集、实时识别
/clusters               # 聚类浏览 - 网格展示所有聚类
/clusters/[id]          # 聚类详情 - 查看某个聚类的所有人脸
/annotate               # 标注工作台 - 待标注队列
/identities             # 身份库 - 已确认的人员管理
/identities/[id]        # 人员详情 - 某人的所有人脸
/recognition            # 识别监控 - 实时识别事件流
/settings               # 系统设置 - 阈值、模型配置、摄像头管理
```

---

## 🚀 开发进度

| 阶段 | 内容 | 状态 |
|------|------|--------|
| **Phase 1** | 基础框架、数据库、pgvector、Server Actions 架构 | ✅ 完成 |
| **Phase 2** | @vladmandic/human 集成、人脸检测、特征提取 | ✅ 完成 |
| **Phase 3** | 本地摄像头接入、实时检测预览 | ✅ 完成 |
| **Phase 4** | 聚类算法、聚类浏览页面 | ✅ 完成 |
| **Phase 5** | 标注工作台、身份绑定 | ✅ 完成 |
| **Phase 6** | 实时识别、增量聚类 | ✅ 完成 |
| **Phase 7** | 仪表盘统计、识别监控 | ✅ 完成 |
| **Phase 8** | 多摄像头支持、远程摄像头 | 🟡 进行中 |
| **Phase 9** | Podman 容器化部署 | 🟢 待开始 |

---

## 🐳 Podman 部署

### 开发环境

```bash
# 启动数据库容器
podman run -d \
  --name facial-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=facial \
  -p 5433:5432 \
  pgvector/pgvector:0.8.1-pg18-trixie

# 启用 vector 扩展
podman exec -it facial-postgres psql -U postgres -d facial -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 生产部署 (podman-compose)

```yaml
# podman-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/facial
    depends_on:
      - db
      
  db:
    image: pgvector/pgvector:0.8.1-pg18-trixie
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=facial
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 常用命令

```bash
# 数据库操作
pnpm db:generate   # 生成迁移文件
pnpm db:migrate    # 执行迁移
pnpm db:push       # 直接推送 schema (开发用)
pnpm db:studio     # 打开 Drizzle Studio

# 开发
pnpm dev           # 启动开发服务器
pnpm build         # 构建生产版本
pnpm start         # 启动生产服务器
```

---
