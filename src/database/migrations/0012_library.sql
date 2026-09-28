-- The library: files in storage indexed with what was read from them, content items (media
-- plus metadata, not scheduled yet), and brands (the user's groups of channels).
CREATE TABLE `media_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`status` text DEFAULT 'uploading' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_files_key_unique` ON `media_files` (`key`);
--> statement-breakpoint
CREATE INDEX `media_files_user_created_idx` ON `media_files` (`user_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE TABLE `library_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`caption` text,
	`description` text,
	`metadata` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `library_items_user_created_idx` ON `library_items` (`user_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE TABLE `library_item_files` (
	`item_id` text NOT NULL,
	`file_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`item_id`, `file_id`),
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `media_files`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `library_item_files_file_idx` ON `library_item_files` (`file_id`);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brands_user_idx` ON `brands` (`user_id`);
--> statement-breakpoint
CREATE TABLE `brand_accounts` (
	`brand_id` text NOT NULL,
	`account_id` text NOT NULL,
	PRIMARY KEY(`brand_id`, `account_id`),
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `social_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brand_accounts_account_idx` ON `brand_accounts` (`account_id`);
--> statement-breakpoint
-- The new "library" permission. Keys that had every permission so far keep having every
-- permission, whatever order they list them in.
UPDATE `api_keys` SET `scopes` = json_insert(`scopes`, '$[#]', 'library')
WHERE (
  SELECT count(DISTINCT `value`) FROM json_each(`api_keys`.`scopes`)
  WHERE `value` IN ('read', 'publish', 'manage', 'comments', 'analytics', 'storage', 'channels')
) = 7
AND NOT EXISTS (SELECT 1 FROM json_each(`api_keys`.`scopes`) WHERE `value` = 'library');
