import {
  pgTable,
  pgSchema,
  text,
  timestamp,
  jsonb,
  boolean,
  real,
  integer,
  index,
  vector,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// 定义自定义 schema
export const facialSchema = pgSchema('facial')

// ============================================
// 0. 摄像头源
// ============================================
export const cameras = facialSchema.table('cameras', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<'local' | 'remote' | 'ip'>(),
  streamUrl: text('stream_url'),
  status: text('status').default('offline').$type<'online' | 'offline'>(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const camerasRelations = relations(cameras, ({ many }) => ({
  recognitionLogs: many(recognitionLogs),
}))

// ============================================
// 1. 原始图片/视频帧
// ============================================
export const images = facialSchema.table('images', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull().$type<'upload' | 'camera' | 'video'>(),
  sourceId: text('source_id'), // camera_id 或 upload batch id
  filePath: text('file_path').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  processed: boolean('processed').default(false),
})

export const imagesRelations = relations(images, ({ many }) => ({
  faces: many(faces),
}))

// ============================================
// 2. 检测到的人脸
// ============================================
export const faces = facialSchema.table(
  'faces',
  {
    id: text('id').primaryKey(),
    imageId: text('image_id').references(() => images.id, { onDelete: 'cascade' }),
    bbox: jsonb('bbox').notNull().$type<{
      x: number
      y: number
      width: number
      height: number
    }>(),
    qualityScore: real('quality_score'),
    embedding: vector('embedding', { dimensions: 512 }),
    thumbnailPath: text('thumbnail_path'), // 人脸缩略图路径
    age: real('age'),
    gender: text('gender').$type<'male' | 'female' | 'unknown'>(),
    emotion: text('emotion'),
    clusterId: text('cluster_id').references(() => clusters.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('faces_cluster_id_idx').on(table.clusterId),
    index('faces_image_id_idx').on(table.imageId),
  ]
)

export const facesRelations = relations(faces, ({ one }) => ({
  image: one(images, {
    fields: [faces.imageId],
    references: [images.id],
  }),
  cluster: one(clusters, {
    fields: [faces.clusterId],
    references: [clusters.id],
  }),
}))

// ============================================
// 3. 聚类 (未标注的分组)
// ============================================
export const clusters = facialSchema.table('clusters', {
  id: text('id').primaryKey(),
  faceCount: integer('face_count').default(0),
  representativeFaceId: text('representative_face_id'),
  centroid: vector('centroid', { dimensions: 512 }),
  status: text('status').default('pending').$type<'pending' | 'confirmed' | 'merged'>(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const clustersRelations = relations(clusters, ({ many, one }) => ({
  faces: many(faces),
  identityClusters: many(identityClusters),
  representativeFace: one(faces, {
    fields: [clusters.representativeFaceId],
    references: [faces.id],
  }),
}))

// ============================================
// 4. 已标注身份
// ============================================
export const identities = facialSchema.table('identities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  avatarPath: text('avatar_path'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const identitiesRelations = relations(identities, ({ many }) => ({
  identityClusters: many(identityClusters),
  recognitionLogs: many(recognitionLogs),
}))

// ============================================
// 5. 身份-聚类关联
// ============================================
export const identityClusters = facialSchema.table(
  'identity_clusters',
  {
    id: text('id').primaryKey(),
    identityId: text('identity_id')
      .references(() => identities.id, { onDelete: 'cascade' })
      .notNull(),
    clusterId: text('cluster_id')
      .references(() => clusters.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('identity_clusters_identity_idx').on(table.identityId),
    index('identity_clusters_cluster_idx').on(table.clusterId),
  ]
)

export const identityClustersRelations = relations(identityClusters, ({ one }) => ({
  identity: one(identities, {
    fields: [identityClusters.identityId],
    references: [identities.id],
  }),
  cluster: one(clusters, {
    fields: [identityClusters.clusterId],
    references: [clusters.id],
  }),
}))

// ============================================
// 6. 识别记录
// ============================================
export const recognitionLogs = facialSchema.table(
  'recognition_logs',
  {
    id: text('id').primaryKey(),
    faceId: text('face_id').references(() => faces.id, { onDelete: 'set null' }),
    matchedIdentityId: text('matched_identity_id').references(() => identities.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence'),
    cameraId: text('camera_id').references(() => cameras.id, { onDelete: 'set null' }),
    isStranger: boolean('is_stranger').default(false), // 是否为陌生人
    thumbnailPath: text('thumbnail_path'), // 识别时的截图
    timestamp: timestamp('timestamp').defaultNow(),
  },
  (table) => [
    index('recognition_logs_identity_idx').on(table.matchedIdentityId),
    index('recognition_logs_timestamp_idx').on(table.timestamp),
  ]
)

export const recognitionLogsRelations = relations(recognitionLogs, ({ one }) => ({
  face: one(faces, {
    fields: [recognitionLogs.faceId],
    references: [faces.id],
  }),
  identity: one(identities, {
    fields: [recognitionLogs.matchedIdentityId],
    references: [identities.id],
  }),
  camera: one(cameras, {
    fields: [recognitionLogs.cameraId],
    references: [cameras.id],
  }),
}))

// ============================================
// Type Exports
// ============================================
export type Camera = typeof cameras.$inferSelect
export type NewCamera = typeof cameras.$inferInsert

export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert

export type Face = typeof faces.$inferSelect
export type NewFace = typeof faces.$inferInsert

export type Cluster = typeof clusters.$inferSelect
export type NewCluster = typeof clusters.$inferInsert

export type Identity = typeof identities.$inferSelect
export type NewIdentity = typeof identities.$inferInsert

export type IdentityCluster = typeof identityClusters.$inferSelect
export type NewIdentityCluster = typeof identityClusters.$inferInsert

export type RecognitionLog = typeof recognitionLogs.$inferSelect
export type NewRecognitionLog = typeof recognitionLogs.$inferInsert
