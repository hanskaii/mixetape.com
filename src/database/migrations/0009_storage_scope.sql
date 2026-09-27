-- The new "storage" permission. Keys made before permissions existed had full access,
-- so they keep it.
UPDATE `api_keys` SET `scopes` = '["read","publish","manage","comments","analytics","storage"]'
WHERE `scopes` = '["read","publish","manage","comments","analytics"]';
