ALTER TABLE `youtube_rankings` ADD `duration_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `video_format` text DEFAULT 'LONG_FORM' NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube_rankings` ADD `format_population_size` integer DEFAULT 0 NOT NULL;