-- The new "channels" permission (connect_channel and its follow-ups). Keys that had every
-- permission so far keep having every permission, whatever order they list them in.
UPDATE `api_keys` SET `scopes` = json_insert(`scopes`, '$[#]', 'channels')
WHERE (
  SELECT count(DISTINCT `value`) FROM json_each(`api_keys`.`scopes`)
  WHERE `value` IN ('read', 'publish', 'manage', 'comments', 'analytics', 'storage')
) = 6
AND NOT EXISTS (SELECT 1 FROM json_each(`api_keys`.`scopes`) WHERE `value` = 'channels');
