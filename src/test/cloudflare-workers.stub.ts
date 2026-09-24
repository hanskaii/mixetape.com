// Stand-in for the `cloudflare:workers` module in unit tests, which run in plain Node.
// Tests set the bindings they need on `env` directly.
export const env: Record<string, any> = {};
