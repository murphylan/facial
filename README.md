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

## 📋 功能模块

### 1. 数据采集
- 图片/视频批量上传
- 实时摄像头接入 (WebRTC)
- 视频帧抽取

### 2. 人脸处理
- 人脸检测与对齐
- 特征向量提取 (512维 embedding)
- 质量评估过滤

### 3. 无监督聚类
- 自动将相似人脸分组
- 增量聚类支持
- 合并/拆分调整

### 4. 人工标注
- 聚类审核确认
- 身份信息绑定
- 错误修正

### 5. 实时识别
- 新人脸与已标注库匹配
- 可配置相似度阈值
- 陌生人检测告警

---

## 📱 页面导航

| 页面 | 路径 | 功能 |
|-----|------|------|
| 仪表盘 | `/` | 统计概览 |
| 数据上传 | `/upload` | 拖拽上传、批量管理 |
| 实时摄像头 | `/camera` | 预览、采集、实时识别 |
| 聚类浏览 | `/clusters` | 查看自动分组结果 |
| 标注工作台 | `/annotate` | 为聚类分配身份 |
| 身份库 | `/identities` | 已确认的人员管理 |
| 识别监控 | `/recognition` | 实时识别事件流 |
| 系统设置 | `/settings` | 阈值、模型配置 |

---

## 🚀 开发进度

| 阶段 | 内容 | 状态 |
|------|------|--------|
| Phase 1 | 基础框架、数据库、pgvector | ✅ 完成 |
| Phase 2 | 人脸检测、特征提取 | ✅ 完成 |
| Phase 3 | 本地摄像头接入 | ✅ 完成 |
| Phase 4 | 聚类算法、聚类浏览 | ✅ 完成 |
| Phase 5 | 标注工作台、身份绑定 | ✅ 完成 |
| Phase 6 | 实时识别、增量聚类 | ✅ 完成 |
| Phase 7 | 仪表盘统计、识别监控 | ✅ 完成 |
| Phase 8 | 多摄像头支持 | 🟡 进行中 |
| Phase 9 | Podman 容器化部署 | 🟢 待开始 |

---

## 🐳 部署

### 开发环境

```bash
pnpm dev           # 启动开发服务器
pnpm db:push       # 推送数据库 schema
pnpm db:studio     # 打开 Drizzle Studio
```

### 生产部署 (podman-compose)

```yaml
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

## 📚 技术文档

详细的技术规范请参考 `.cursor/rules/` 目录：

- `architecture.mdc` - 系统架构与目录结构
- `coding-standards.mdc` - 开发规范 (Server Actions、Hooks)
- `database.mdc` - 数据库设计 (Drizzle Schema)
- `ai-ml.mdc` - AI/ML 技术方案
