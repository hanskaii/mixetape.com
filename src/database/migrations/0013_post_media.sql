-- Posts with several files (carousels, albums) and posts scheduled from the library.
-- `media` lists every file of a post with its kind; existing posts keep it null and are
-- read as their one media_url. `item_id` is the library item a post came from.
ALTER TABLE `social_posts` ADD `media` text;
--> statement-breakpoint
ALTER TABLE `social_posts` ADD `item_id` text REFERENCES `library_items`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `social_posts_item_idx` ON `social_posts` (`item_id`);
