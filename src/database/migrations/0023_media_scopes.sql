-- The storage and library permissions are now media and groups, after the workspace page
-- was renamed Media & Storage. Keys, MCP clients, tokens and consents keep what they had.
UPDATE `api_keys` SET `scopes` = REPLACE(REPLACE(`scopes`, '"storage"', '"media"'), '"library"', '"groups"');
UPDATE `oauth_client` SET `scopes` = REPLACE(REPLACE(`scopes`, '"storage"', '"media"'), '"library"', '"groups"') WHERE `scopes` IS NOT NULL;
UPDATE `oauth_access_token` SET `scopes` = REPLACE(REPLACE(`scopes`, '"storage"', '"media"'), '"library"', '"groups"');
UPDATE `oauth_refresh_token` SET `scopes` = REPLACE(REPLACE(`scopes`, '"storage"', '"media"'), '"library"', '"groups"');
UPDATE `oauth_consent` SET `scopes` = REPLACE(REPLACE(`scopes`, '"storage"', '"media"'), '"library"', '"groups"');
