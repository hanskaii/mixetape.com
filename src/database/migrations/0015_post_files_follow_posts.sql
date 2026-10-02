-- Every post now lets go of its files in storage once it is published or cancelled, so the
-- per-post flag that asked for it (library publishing only) is gone.
ALTER TABLE `social_posts` DROP COLUMN `cleanup`;
