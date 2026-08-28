import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const youtubeSnapshots = sqliteTable("youtube_snapshots", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  scope: text("scope").notNull(),
  categoryId: text("category_id"),
  capturedAt: integer("captured_at").notNull(),
  capturedBucket: integer("captured_bucket").notNull(),
  itemCount: integer("item_count").notNull(),
}, (table) => [
  uniqueIndex("youtube_snapshots_region_scope_bucket_uq").on(
    table.region,
    table.scope,
    table.capturedBucket,
  ),
  index("youtube_snapshots_scope_captured_idx").on(table.scope, table.capturedAt),
]);

export const youtubeRankings = sqliteTable("youtube_rankings", {
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => youtubeSnapshots.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  rank: integer("rank").notNull(),
  previousRank: integer("previous_rank"),
  delta: integer("delta"),
  isNew: integer("is_new", { mode: "boolean" }).notNull().default(false),
  views: integer("views").notNull(),
  likes: integer("likes").notNull(),
  viewsPerHour: integer("views_per_hour").notNull().default(0),
  title: text("title").notNull(),
  channel: text("channel").notNull(),
  categoryId: text("category_id"),
  categoryName: text("category_name").notNull(),
  thumbnail: text("thumbnail").notNull(),
  description: text("description").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  publishedAt: integer("published_at"),
}, (table) => [
  primaryKey({ columns: [table.snapshotId, table.videoId] }),
  index("youtube_rankings_video_snapshot_idx").on(table.videoId, table.snapshotId),
  index("youtube_rankings_category_snapshot_idx").on(table.categoryName, table.snapshotId),
]);
