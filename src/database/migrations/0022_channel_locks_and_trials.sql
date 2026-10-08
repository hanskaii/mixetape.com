-- A channel beyond what the plan covers after a downgrade is locked rather than removed; a
-- subscription in its free trial remembers when the trial ends, for the reminder email.
ALTER TABLE `social_accounts` ADD `locked` integer DEFAULT false NOT NULL;
ALTER TABLE `subscriptions` ADD `trial_ends_at` integer;
