CREATE TABLE `provider_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_credentials_user_idx` ON `provider_credentials` (`user_id`);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`provider` text NOT NULL,
	`platform_account_id` text NOT NULL,
	`name` text NOT NULL,
	`handle` text,
	`avatar` text,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`scopes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`credential_id`) REFERENCES `provider_credentials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_platform_idx` ON `social_accounts` (`user_id`,`provider`,`platform_account_id`);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider` text NOT NULL,
	`media_url` text NOT NULL,
	`caption` text,
	`metadata` text,
	`scheduled_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`platform_post_id` text,
	`platform_url` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `social_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_posts_user_scheduled_idx` ON `social_posts` (`user_id`,`scheduled_at`);
--> statement-breakpoint
CREATE INDEX `social_posts_status_idx` ON `social_posts` (`status`);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`hash`);
--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);
