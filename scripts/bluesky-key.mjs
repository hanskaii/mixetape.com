// Makes mixetape's Bluesky OAuth key: an ES256 private key as a one-line JWK with a kid,
// for the Secrets Store secret mixetape-bluesky-private-key (BLUESKY_PRIVATE_KEY). Its
// public half is published in /api/connect/bluesky/client-metadata.json.
//
//   node scripts/bluesky-key.mjs
//
// Prints the private key: put it straight into the Secrets Store, never in the repository.
import { exportJWK, generateKeyPair } from "jose";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = await exportJWK(privateKey);
const kid = `mixetape-${new Date().toISOString().slice(0, 10)}`;
process.stdout.write(`${JSON.stringify({ ...jwk, kid, alg: "ES256" })}\n`);
