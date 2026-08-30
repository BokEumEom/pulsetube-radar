CREATE TABLE `youtube_collector_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`scopes_total` integer NOT NULL,
	`scopes_succeeded` integer DEFAULT 0 NOT NULL,
	`videos_collected` integer DEFAULT 0 NOT NULL,
	`quota_units` integer DEFAULT 0 NOT NULL,
	`error_summary` text
);
--> statement-breakpoint
CREATE INDEX `youtube_collector_runs_started_idx` ON `youtube_collector_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `youtube_collector_runs_status_started_idx` ON `youtube_collector_runs` (`status`,`started_at`);--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `previous_views_per_hour` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `view_acceleration` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `sample_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `velocity_percentile` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `acceleration_percentile` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `momentum_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `breakout_status` text DEFAULT 'NONE' NOT NULL;