CREATE TABLE `youtube_rankings` (
	`snapshot_id` text NOT NULL,
	`video_id` text NOT NULL,
	`rank` integer NOT NULL,
	`previous_rank` integer,
	`delta` integer,
	`is_new` integer DEFAULT false NOT NULL,
	`views` integer NOT NULL,
	`likes` integer NOT NULL,
	`views_per_hour` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`channel` text NOT NULL,
	`category_id` text,
	`category_name` text NOT NULL,
	`thumbnail` text NOT NULL,
	`description` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`published_at` integer,
	PRIMARY KEY(`snapshot_id`, `video_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `youtube_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `youtube_rankings_video_snapshot_idx` ON `youtube_rankings` (`video_id`,`snapshot_id`);--> statement-breakpoint
CREATE INDEX `youtube_rankings_category_snapshot_idx` ON `youtube_rankings` (`category_name`,`snapshot_id`);--> statement-breakpoint
CREATE TABLE `youtube_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`scope` text NOT NULL,
	`category_id` text,
	`captured_at` integer NOT NULL,
	`captured_bucket` integer NOT NULL,
	`item_count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `youtube_snapshots_region_scope_bucket_uq` ON `youtube_snapshots` (`region`,`scope`,`captured_bucket`);--> statement-breakpoint
CREATE INDEX `youtube_snapshots_scope_captured_idx` ON `youtube_snapshots` (`scope`,`captured_at`);