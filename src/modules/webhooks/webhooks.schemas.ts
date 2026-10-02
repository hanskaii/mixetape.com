import { object } from "#/modules/api/input";
import { EVENT_TYPES, WEBHOOK_EVENTS } from "./webhooks.service";

/** Field schemas shared by the webhooks' REST endpoints and MCP tools. */

const EVENTS_DESCRIPTION = `What to be told about: ${EVENT_TYPES.map(
  (event) => `${event} (${WEBHOOK_EVENTS[event].toLowerCase()})`,
).join("; ")}. Left out on create, all of them.`;

export const WEBHOOK_FIELDS = {
  url: { type: "string", description: "The https endpoint that receives the events" },
  events: {
    type: "array",
    items: { type: "string", enum: EVENT_TYPES },
    description: EVENTS_DESCRIPTION,
  },
  description: { type: ["string", "null"], description: "A note on what it is for" },
};

export const WEBHOOK_CHANGES = {
  ...WEBHOOK_FIELDS,
  enabled: {
    type: "boolean",
    description: "false turns it off; true turns it back on and clears its failure count",
  },
};

export const WEBHOOK = object(
  {
    id: { type: "string" },
    url: { type: "string" },
    description: { type: ["string", "null"] },
    events: { type: "array", items: { type: "string", enum: EVENT_TYPES } },
    enabled: {
      type: "boolean",
      description: "Turned off by hand, or after 20 events in a row failed every retry",
    },
    failures: { type: "integer", description: "Events in a row that failed every retry" },
    lastDeliveryAt: { type: ["string", "null"], format: "date-time" },
    lastStatus: { type: ["integer", "null"], description: "The endpoint's last HTTP status" },
    lastError: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
  },
  ["id", "url", "events", "enabled", "failures", "createdAt"],
);

export const SECRET = {
  type: "string",
  description:
    "The signing secret (whsec_…), shown only now. Verify each delivery's webhook-signature with it (Standard Webhooks).",
};

export const TEST_RESULT = object(
  {
    delivered: { type: "boolean" },
    status: { type: ["integer", "null"], description: "The endpoint's HTTP status" },
    error: { type: ["string", "null"] },
  },
  ["delivered", "status", "error"],
);
