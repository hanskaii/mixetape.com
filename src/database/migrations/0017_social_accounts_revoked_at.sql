-- When a platform reports a channel's access revoked; its data is deleted if it is not
-- connected again (YouTube API Services: within 7 days of the revocation).
ALTER TABLE `social_accounts` ADD `revoked_at` integer;
