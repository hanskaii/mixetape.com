-- How many minutes before its go-live time a post leaves mixetape for the platform. The
-- platform processes it (e.g. YouTube's HD versions) in that window, then publishes it.
ALTER TABLE `social_posts` ADD `lead_minutes` integer;
