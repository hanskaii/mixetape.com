-- When Dodo sent the webhook that last updated a subscription, so one arriving late does not
-- overwrite a newer state.
ALTER TABLE `subscriptions` ADD `event_at` integer;
