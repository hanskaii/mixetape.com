-- Writes sent with an Idempotency-Key keep their first answer for 24 hours, so an agent that
-- retries after a dropped connection gets that answer instead of a second post.
CREATE TABLE `idempotency_keys` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` integer,
	`response` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idempotency_keys_created_idx` ON `idempotency_keys` (`created_at`);
