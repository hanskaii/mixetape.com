-- Billing through Dodo Payments: the Better Auth plugin's customer id on each user, a flag
-- for accounts that publish without a plan, and each subscription as its webhooks report it.
ALTER TABLE `user` ADD `dodo_customer_id` text;
ALTER TABLE `user` ADD `billing_exempt` integer DEFAULT false NOT NULL;

CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`plan` text NOT NULL,
	`period` text NOT NULL,
	`status` text NOT NULL,
	`accounts` integer NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`next_billing_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);
