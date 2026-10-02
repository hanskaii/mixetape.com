import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** A value that survives JSON — what a JSON column may hold. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  bio: text("bio"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  issuer: text("issuer"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const twoFactor = sqliteTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: integer("verified", { mode: "boolean" }).default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
});

// ── Social publishing ──────────────────────────────────────────────────────────
//
// An account is a channel connected through mixetape's own app for its platform (the app's
// client id and secret live in the Secrets Store, see social.service); a post is one piece
// of media scheduled for one account. Tokens are stored encrypted (see secrets/crypto.ts).

export const socialAccounts = sqliteTable(
  "social_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    platformAccountId: text("platform_account_id").notNull(), // YouTube channel id
    name: text("name").notNull(),
    handle: text("handle"),
    avatar: text("avatar"),
    accessToken: text("access_token").notNull(), // encrypted
    refreshToken: text("refresh_token"), // encrypted
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    scopes: text("scopes"),
    status: text("status").notNull().default("active"), // 'active' | 'reconnect'
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("social_accounts_platform_idx").on(
      table.userId,
      table.provider,
      table.platformAccountId,
    ),
  ],
);

export const socialPosts = sqliteTable(
  "social_posts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    mediaUrl: text("media_url").notNull(), // the first file; the only one unless a carousel
    // Every file, in order, with its kind; null on posts from before carousels (one video).
    media: text("media", { mode: "json" }).$type<{ url: string; kind: "video" | "image" }[]>(),
    // The library group the post was published from, if any.
    groupId: text("group_id").references(() => mediaGroups.id, { onDelete: "set null" }),
    caption: text("caption"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, JsonValue>>(), // per-platform fields
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }).notNull(),
    // 'scheduled' → 'publishing' → 'published' | 'failed'; 'cancelled' by the user
    status: text("status").notNull().default("scheduled"),
    platformPostId: text("platform_post_id"),
    platformUrl: text("platform_url"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    workflowId: text("workflow_id"), // the workflow instance allowed to publish this post
    leadMinutes: integer("lead_minutes"), // uploaded this long before scheduledAt (see timing.ts)
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("social_posts_user_scheduled_idx").on(table.userId, table.scheduledAt),
    index("social_posts_status_idx").on(table.status),
    index("social_posts_group_idx").on(table.groupId),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(), // first characters, to recognise a key in the list
    hash: text("hash").notNull().unique(), // SHA-256 of the key; the key itself is never stored
    // What the key may do (api-keys.service API_SCOPES). Keys made before permissions existed
    // keep full access.
    scopes: text("scopes", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'["read","publish","manage","comments","analytics","storage"]'`),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("api_keys_user_idx").on(table.userId)],
);

// A write sent with an Idempotency-Key (REST header, or the MCP tools' idempotencyKey): the
// first request runs and its answer is kept for 24 hours, so a retry gets that answer back
// instead of scheduling the same post twice.
export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    // SHA-256 of what the request asked for: the same key with another request is refused.
    fingerprint: text("fingerprint").notNull(),
    // Null while the first request still runs.
    status: integer("status"),
    response: text("response", { mode: "json" }).$type<unknown>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index("idempotency_keys_created_idx").on(table.createdAt),
  ],
);

// ── Library ────────────────────────────────────────────────────────────────────
//
// Files in mixetape storage (R2, under media/<userId>/), indexed here with what was read
// from the file itself (staged: kept until a post is out, or 24 hours with none); groups —
// files that go out together, with the words drafted for them; and brands, the user's own
// groups of channels.

export const mediaFiles = sqliteTable(
  "media_files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(), // R2 key; the file's r2:// URL is r2://<key>
    name: text("name").notNull(),
    kind: text("kind").notNull(), // 'video' | 'image' | 'other'
    contentType: text("content_type").notNull(),
    size: integer("size").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    // 'uploading' until finish_upload has checked it in R2; then 'ready', or 'failed'
    status: text("status").notNull().default("uploading"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("media_files_user_created_idx").on(table.userId, table.createdAt, table.id)],
);

/**
 * A group: files that go out together — a carousel, an album — with the words an agent (or
 * the user) drafted for them, which the publish dialog starts from.
 */
export const mediaGroups = sqliteTable(
  "media_groups",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    caption: text("caption"),
    description: text("description"),
    // Shared fields (tags, thumbnailUrl, firstComment…) plus `platforms: { youtube: {…} }`,
    // each platform's overrides.
    metadata: text("metadata", { mode: "json" }).$type<Record<string, JsonValue>>(),
    createdBy: text("created_by").notNull(), // 'agent' | 'user'
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("media_groups_user_created_idx").on(table.userId, table.createdAt, table.id)],
);

/** Which group a file is in (at most one), and its place there. */
export const mediaGroupFiles = sqliteTable(
  "media_group_files",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => mediaGroups.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => mediaFiles.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0), // order, e.g. of a carousel's images
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.fileId] }),
    uniqueIndex("media_group_files_file_unique").on(table.fileId),
  ],
);

export const brands = sqliteTable(
  "brands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("brands_user_idx").on(table.userId)],
);

export const brandAccounts = sqliteTable(
  "brand_accounts",
  {
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.brandId, table.accountId] }),
    index("brand_accounts_account_idx").on(table.accountId),
  ],
);

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type MediaGroup = typeof mediaGroups.$inferSelect;
export type Brand = typeof brands.$inferSelect;
