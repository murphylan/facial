# 无感人脸识别系统 - 需求与技术方案

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
| 数据库 | PostgreSQL 17 + pgvector |
| AI 方案 | Node.js 原生库 (无 Python 依赖) |
| 摄像头 | 单摄像头 → 多摄像头扩展 |

### 数据库连接

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/requirement?schema=facial"
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
app/
├── actions/                    # Server Actions (所有数据操作)
│   ├── upload.ts              # 上传相关
│   ├── face.ts                # 人脸相关
│   ├── cluster.ts             # 聚类相关
│   ├── identity.ts            # 身份相关
│   ├── annotation.ts          # 标注相关
│   └── recognition.ts         # 识别相关
├── (dashboard)/               # 页面路由组
│   ├── page.tsx               # 仪表盘
│   ├── upload/
│   ├── clusters/
│   ├── annotate/
│   ├── identities/
│   ├── recognition/
│   └── settings/
├── layout.tsx
└── providers.tsx              # React Query Provider

components/
├── ui/                        # shadcn/ui 组件
├── camera/                    # 摄像头相关组件
│   ├── camera-feed.tsx       # 视频流显示
│   ├── camera-selector.tsx   # 摄像头选择
│   └── face-overlay.tsx      # 人脸框叠加层
├── upload/                    # 上传相关组件
├── cluster/                   # 聚类相关组件
├── annotation/                # 标注相关组件
├── identity/                  # 身份相关组件
└── recognition/               # 识别相关组件

hooks/                         # React Query Hooks
├── use-camera.ts              # 摄像头控制
├── use-upload.ts              # useQuery + useMutation
├── use-faces.ts               # useQuery + useMutation
├── use-clusters.ts            # useQuery + useMutation
├── use-identities.ts          # useQuery + useMutation
├── use-annotations.ts         # useQuery + useMutation
└── use-recognition.ts         # useQuery + useMutation

stores/                        # Zustand Stores (仅客户端UI状态)
├── camera-store.ts            # 摄像头状态、当前帧
├── upload-store.ts            # 上传进度、队列状态
├── annotation-store.ts        # 标注工作台 UI 状态
└── settings-store.ts          # 用户偏好设置

db/
├── index.ts                   # Drizzle 客户端
├── schema.ts                  # 表定义
└── migrations/                # 迁移文件

lib/
├── human.ts                   # @vladmandic/human 封装
├── clustering.ts              # 聚类算法
├── embedding.ts               # 向量操作 (比较、搜索)
└── utils.ts                   # 工具函数
```

---

## 💾 数据库设计 (Drizzle Schema)

```typescript
// db/schema.ts
import { pgTable, text, timestamp, jsonb, boolean, real, integer, index } from 'drizzle-orm/pg-core'
import { vector } from 'drizzle-orm/pg-core' // 需要 pgvector 扩展

// 0. 摄像头源
export const cameras = pgTable('cameras', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'local' | 'remote' | 'ip'
  streamUrl: text('stream_url'),
  status: text('status').default('offline'), // 'online' | 'offline'
  createdAt: timestamp('created_at').defaultNow(),
})

// 1. 原始图片/视频帧
export const images = pgTable('images', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull(), // 'upload' | 'camera' | 'video'
  sourceId: text('source_id'), // camera_id 或 upload batch id
  filePath: text('file_path').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  processed: boolean('processed').default(false),
})

// 2. 检测到的人脸
export const faces = pgTable('faces', {
  id: text('id').primaryKey(),
  imageId: text('image_id').references(() => images.id),
  bbox: jsonb('bbox').notNull(), // { x, y, width, height }
  qualityScore: real('quality_score'),
  embedding: vector('embedding', { dimensions: 512 }), // @vladmandic/human 输出 512 维
  age: real('age'),
  gender: text('gender'),
  emotion: text('emotion'),
  clusterId: text('cluster_id').references(() => clusters.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  embeddingIdx: index('faces_embedding_idx').using('ivfflat', table.embedding), // 向量索引
}))

// 3. 聚类 (未标注的分组)
export const clusters = pgTable('clusters', {
  id: text('id').primaryKey(),
  faceCount: integer('face_count').default(0),
  representativeFaceId: text('representative_face_id'),
  centroid: vector('centroid', { dimensions: 512 }), // 聚类中心向量
  status: text('status').default('pending'), // 'pending' | 'confirmed' | 'merged'
  createdAt: timestamp('created_at').defaultNow(),
})

// 4. 已标注身份
export const identities = pgTable('identities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  avatarPath: text('avatar_path'), // 代表照片
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 5. 身份-聚类关联 (一个身份可以对应多个聚类)
export const identityClusters = pgTable('identity_clusters', {
  id: text('id').primaryKey(),
  identityId: text('identity_id').references(() => identities.id, { onDelete: 'cascade' }),
  clusterId: text('cluster_id').references(() => clusters.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
})

// 6. 识别记录
export const recognitionLogs = pgTable('recognition_logs', {
  id: text('id').primaryKey(),
  faceId: text('face_id').references(() => faces.id),
  matchedIdentityId: text('matched_identity_id').references(() => identities.id),
  confidence: real('confidence'),
  cameraId: text('camera_id').references(() => cameras.id),
  timestamp: timestamp('timestamp').defaultNow(),
})
```

### pgvector 初始化

```sql
-- 在 PostgreSQL 中启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建向量索引 (可选，提升查询速度)
CREATE INDEX ON faces USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
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

## 🚀 开发阶段建议

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| **Phase 1** | 基础框架、数据库、pgvector、Server Actions 架构 | 🔴 |
| **Phase 2** | @vladmandic/human 集成、人脸检测、特征提取 | 🔴 |
| **Phase 3** | 本地摄像头接入、实时检测预览 | 🔴 |
| **Phase 4** | 聚类算法、聚类浏览页面 | 🔴 |
| **Phase 5** | 标注工作台、身份绑定 | 🟡 |
| **Phase 6** | 实时识别、增量聚类 | 🟡 |
| **Phase 7** | 多摄像头支持、远程摄像头 | 🟢 |
| **Phase 8** | Podman 容器化部署 | 🟢 |

---

## 🐳 Podman 部署 (后期)

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
    image: pgvector/pgvector:pg17
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

---
