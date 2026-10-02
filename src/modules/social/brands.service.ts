import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "#/database/index";
import { brandAccounts, brands, socialAccounts } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";

/**
 * Brands: the user's own groups of connected channels (say "Hans Explainer" = its YouTube
 * channel and its Facebook Page), so content can go to a brand rather than channel by
 * channel. A channel can belong to several brands; disconnecting it takes it out of them.
 */

async function brandViews(userId: string) {
  const rows = await db.query.brands.findMany({
    where: eq(brands.userId, userId),
    orderBy: [asc(brands.name)],
  });
  if (!rows.length) return [];
  const links = await db.query.brandAccounts.findMany({
    where: inArray(
      brandAccounts.brandId,
      rows.map((brand) => brand.id),
    ),
  });
  return rows.map((brand) => ({
    id: brand.id,
    name: brand.name,
    accountIds: links.filter((link) => link.brandId === brand.id).map((link) => link.accountId),
    createdAt: brand.createdAt,
  }));
}

export const listBrands = (userId: string) => brandViews(userId);

async function ownedBrand(userId: string, id: string) {
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.id, id), eq(brands.userId, userId)),
  });
  if (!brand) throw new ServiceError("Brand not found", 404);
  return brand;
}

/** The given accounts, all the user's; refuses any that are not. */
async function ownedAccounts(userId: string, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  if (!unique.length) return [];
  const found = await db.query.socialAccounts.findMany({
    where: and(eq(socialAccounts.userId, userId), inArray(socialAccounts.id, unique)),
    columns: { id: true },
  });
  const missing = unique.filter((id) => !found.some((account) => account.id === id));
  if (missing.length) throw new ServiceError(`Account not found: ${missing.join(", ")}`, 404);
  return unique;
}

async function checkName(userId: string, name: string, except?: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new ServiceError("Give the brand a name");
  const taken = (await db.query.brands.findMany({ where: eq(brands.userId, userId) })).some(
    (brand) => brand.id !== except && brand.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (taken)
    throw new ServiceError(`There is already a brand called ${trimmed}`, 409, {
      code: "already_exists",
      field: "name",
    });
  return trimmed;
}

async function setAccounts(brandId: string, accountIds: string[]) {
  await db.delete(brandAccounts).where(eq(brandAccounts.brandId, brandId));
  if (accountIds.length)
    await db.insert(brandAccounts).values(accountIds.map((accountId) => ({ brandId, accountId })));
}

const view = async (userId: string, id: string) =>
  (await brandViews(userId)).find((brand) => brand.id === id)!;

export async function createBrand(userId: string, input: { name: string; accountIds?: string[] }) {
  const name = await checkName(userId, input.name);
  const accountIds = await ownedAccounts(userId, input.accountIds ?? []);
  const id = crypto.randomUUID();
  await db.insert(brands).values({ id, userId, name });
  await setAccounts(id, accountIds);
  return view(userId, id);
}

/** Renames a brand and/or replaces its channels. */
export async function updateBrand(
  userId: string,
  id: string,
  input: { name?: string; accountIds?: string[] },
) {
  await ownedBrand(userId, id);
  if (input.name !== undefined) {
    const name = await checkName(userId, input.name, id);
    await db.update(brands).set({ name }).where(eq(brands.id, id));
  }
  if (input.accountIds) await setAccounts(id, await ownedAccounts(userId, input.accountIds));
  return view(userId, id);
}

/** Deletes a brand; its channels stay connected. */
export async function deleteBrand(userId: string, id: string) {
  await ownedBrand(userId, id);
  await db.delete(brands).where(eq(brands.id, id));
  return { deleted: true, id };
}
