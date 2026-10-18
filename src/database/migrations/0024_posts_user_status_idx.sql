-- A user's posts in a given state (the Media page asks which still need their files): the
-- user and schedule index made that a scan of everything they ever published.
CREATE INDEX IF NOT EXISTS `social_posts_user_status_idx` ON `social_posts` (`user_id`, `status`);
