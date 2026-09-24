-- The workflow instance allowed to publish a post. Rescheduling or retrying starts a new
-- instance and hands it the post; an older instance that wakes up later sees it is no
-- longer the owner and stops, so a video is never uploaded twice.
ALTER TABLE `social_posts` ADD `workflow_id` text;
