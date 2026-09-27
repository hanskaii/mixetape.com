-- Every platform now connects through mixetape's own app (client id and secret in the
-- Secrets Store, see social.service#APPS), so per-user app credentials are gone. Connected
-- accounts were tied to them and are reset: each channel is connected again. Dropping
-- social_accounts also clears its posts (ON DELETE CASCADE); there were none.
DROP TABLE `social_accounts`;
--> statement-breakpoint
DROP TABLE `provider_credentials`;
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_platform_idx` ON `social_accounts` (`user_id`,`provider`,`platform_account_id`);
