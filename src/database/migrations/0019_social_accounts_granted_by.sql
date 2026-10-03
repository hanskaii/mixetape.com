-- Who gave access on the platform, when that is not the account itself (a Facebook Page's
-- user): Meta's deauthorize and data-deletion callbacks name that person.
ALTER TABLE `social_accounts` ADD `granted_by` text;
