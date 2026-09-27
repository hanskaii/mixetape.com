-- API keys carry permissions (api-keys.service API_SCOPES). Keys made before this keep
-- full access, so the image-worker and routines keep working.
ALTER TABLE `api_keys` ADD `scopes` text DEFAULT '["read","publish","manage","comments","analytics"]' NOT NULL;
