-- The library becomes file-first: content items become groups — a folder of files that go
-- out together (a carousel), with the words an agent drafted for them — and a file sits in
-- at most one group. Both tables are empty when this runs.
DROP TABLE `library_item_files`;
--> statement-breakpoint
ALTER TABLE `library_items` RENAME TO `media_groups`;
--> statement-breakpoint
DROP INDEX `library_items_user_created_idx`;
--> statement-breakpoint
CREATE INDEX `media_groups_user_created_idx` ON `media_groups` (`user_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE TABLE `media_group_files` (
	`group_id` text NOT NULL,
	`file_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`group_id`, `file_id`),
	FOREIGN KEY (`group_id`) REFERENCES `media_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `media_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_group_files_file_unique` ON `media_group_files` (`file_id`);
--> statement-breakpoint
-- Posts link to the group they were published from, and may clean their files up.
ALTER TABLE `social_posts` RENAME COLUMN `item_id` TO `group_id`;
--> statement-breakpoint
DROP INDEX `social_posts_item_idx`;
--> statement-breakpoint
CREATE INDEX `social_posts_group_idx` ON `social_posts` (`group_id`);
--> statement-breakpoint
ALTER TABLE `social_posts` ADD `cleanup` integer DEFAULT false NOT NULL;
