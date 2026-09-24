import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export function database(d1: D1Database): DrizzleD1Database<typeof schema> {
  if (!d1) {
    throw new Error("Cloudflare D1 binding DATABASE is required");
  }
  return drizzle(d1, { schema });
}

export const db = new Proxy({} as DrizzleD1Database<typeof schema>, {
  get(_target, prop) {
    const target = env.DATABASE;
    if (!target) {
      throw new Error("Cloudflare D1 binding DATABASE is not available in environment");
    }
    const instance = database(target);
    const val = (instance as any)[prop];
    return typeof val === "function" ? val.bind(instance) : val;
  },
});

export { schema };
