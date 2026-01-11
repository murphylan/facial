CREATE SCHEMA "facial";
--> statement-breakpoint
CREATE TABLE "facial"."cameras" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"stream_url" text,
	"status" text DEFAULT 'offline',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "facial"."clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"face_count" integer DEFAULT 0,
	"representative_face_id" text,
	"centroid" vector(1024),
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "facial"."faces" (
	"id" text PRIMARY KEY NOT NULL,
	"image_id" text,
	"bbox" jsonb NOT NULL,
	"quality_score" real,
	"embedding" vector(1024),
	"thumbnail_path" text,
	"age" real,
	"gender" text,
	"emotion" text,
	"cluster_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "facial"."identities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_path" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "facial"."identity_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"identity_id" text NOT NULL,
	"cluster_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "facial"."images" (
	"id" text PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"file_path" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"processed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "facial"."recognition_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"face_id" text,
	"matched_identity_id" text,
	"confidence" real,
	"camera_id" text,
	"is_stranger" boolean DEFAULT false,
	"thumbnail_path" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "facial"."faces" ADD CONSTRAINT "faces_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "facial"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facial"."faces" ADD CONSTRAINT "faces_cluster_id_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "facial"."clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facial"."identity_clusters" ADD CONSTRAINT "identity_clusters_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "facial"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facial"."identity_clusters" ADD CONSTRAINT "identity_clusters_cluster_id_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "facial"."clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facial"."recognition_logs" ADD CONSTRAINT "recognition_logs_face_id_faces_id_fk" FOREIGN KEY ("face_id") REFERENCES "facial"."faces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facial"."recognition_logs" ADD CONSTRAINT "recognition_logs_matched_identity_id_identities_id_fk" FOREIGN KEY ("matched_identity_id") REFERENCES "facial"."identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facial"."recognition_logs" ADD CONSTRAINT "recognition_logs_camera_id_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "facial"."cameras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faces_cluster_id_idx" ON "facial"."faces" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "faces_image_id_idx" ON "facial"."faces" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "identity_clusters_identity_idx" ON "facial"."identity_clusters" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "identity_clusters_cluster_idx" ON "facial"."identity_clusters" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "recognition_logs_identity_idx" ON "facial"."recognition_logs" USING btree ("matched_identity_id");--> statement-breakpoint
CREATE INDEX "recognition_logs_timestamp_idx" ON "facial"."recognition_logs" USING btree ("timestamp");