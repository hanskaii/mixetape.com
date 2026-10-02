import { createFileRoute, useRouter } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { toast } from "sonner";
import { PaperPlaneTilt, Plus, Power, Trash } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { colors } from "../../../../components/ui/tokens.stylex";
import {
  Empty,
  LocalTime,
  Mono,
  Page,
  PageHeader,
  Panel,
  Row,
  Rows,
} from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { CreateApiKeyModal } from "#/components/modals/create-api-key-modal";
import { CreateWebhookModal } from "#/components/modals/create-webhook-modal";
import { getApiKeys, removeApiKey } from "#/modules/social/social.fn";
import { disconnectApp, getConnectedApps } from "#/modules/oauth/oauth.fn";
import {
  getWebhooks,
  removeWebhook,
  sendTestEvent,
  toggleWebhook,
} from "#/modules/webhooks/webhooks.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/api-keys/")({
  loader: async () => {
    const [keys, apps, hooks] = await Promise.all([
      getApiKeys(),
      getConnectedApps(),
      getWebhooks(),
    ]);
    return { ...keys, apps, ...hooks };
  },
  head: () => ({ meta: [{ title: `API keys | ${siteConfig.name}` }] }),
  component: ApiKeysPage,
});

const USED: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

const styles = stylex.create({
  connect: {
    display: "grid",
    gap: "0.5rem",
    paddingBlock: "0.75rem",
    paddingInline: "0.875rem",
  },
  code: {
    backgroundColor: colors.muted,
    borderRadius: "0.625rem",
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.7rem",
    lineHeight: 1.6,
    margin: 0,
    overflowX: "auto",
    padding: "0.625rem",
    whiteSpace: "pre",
  },
  hint: { color: colors.mutedForeground, fontSize: "0.75rem", lineHeight: 1.55, margin: 0 },
});

function ApiKeysPage() {
  const router = useRouter();
  const { keys, scopes, baseUrl, apps, webhooks, events } = Route.useLoaderData();
  const { confirm } = useConfirmModal();
  const { openModal, closeModal } = useModal();

  const create = () =>
    openModal(
      <CreateApiKeyModal
        scopes={scopes}
        baseUrl={baseUrl}
        onClose={closeModal}
        onCreated={() => router.invalidate()}
      />,
    );

  const addWebhook = () =>
    openModal(
      <CreateWebhookModal
        events={events}
        onClose={closeModal}
        onCreated={() => router.invalidate()}
      />,
    );

  const disconnect = (id: string, name: string) =>
    confirm({
      title: `Disconnect ${name}?`,
      description: "It loses access at once; connect it again from the app to use it.",
      confirmText: "Disconnect",
      variant: "destructive",
      onConfirm: async () => {
        await disconnectApp({ data: { id } });
        await router.invalidate();
      },
    });

  const deleteWebhook = (id: string, url: string) =>
    confirm({
      title: "Delete this webhook?",
      description: `${url} stops receiving events at once.`,
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        await removeWebhook({ data: { id } });
        await router.invalidate();
      },
    });

  const test = async (id: string) => {
    const result = await sendTestEvent({ data: { id } });
    if (result.delivered) toast.success(`Test event delivered (HTTP ${result.status})`);
    else toast.error(`Test event not delivered: ${result.error}`);
    await router.invalidate();
  };

  const toggle = async (id: string, enabled: boolean) => {
    await toggleWebhook({ data: { id, enabled } });
    await router.invalidate();
  };

  const remove = (id: string, name: string) =>
    confirm({
      title: "Delete this API key?",
      description: `Anything using "${name}" stops working at once.`,
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        await removeApiKey({ data: { id } });
        await router.invalidate();
      },
    });

  return (
    <Page>
      <PageHeader
        title="API keys"
        description="Agents and pipelines schedule, manage and upload through these."
        actions={
          <Button size="sm" onClick={create}>
            <Plus /> New key
          </Button>
        }
      />

      <Panel title="Connect an agent">
        <div {...stylex.props(styles.connect)}>
          <pre {...stylex.props(styles.code)}>
            {`claude mcp add --transport http mixetape ${baseUrl}/mcp`}
          </pre>
          <p {...stylex.props(styles.hint)}>
            The agent opens a sign-in here and you choose what it may do — no key to paste. In
            Claude or ChatGPT, add <Mono>{baseUrl}/mcp</Mono> as a custom connector. Agents that
            cannot sign in take a key: <Mono>--header "Authorization: Bearer mxt_…"</Mono>. Scripts
            use the REST API: <Mono>{baseUrl}/api/v1</Mono>, described in{" "}
            <Mono>/api/v1/openapi.json</Mono>.
          </p>
        </div>
      </Panel>

      <Panel title="Keys" count={keys.length}>
        {keys.length ? (
          <Rows>
            {keys.map((key) => (
              <Row
                key={key.id}
                title={key.name}
                meta={
                  <Mono>
                    {key.prefix}… · {key.scopes.join(" · ")} ·{" "}
                    {key.lastUsedAt ? (
                      <>
                        used <LocalTime date={key.lastUsedAt} format={USED} />
                      </>
                    ) : (
                      "never used"
                    )}
                  </Mono>
                }
              >
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${key.name}`}
                  onClick={() => remove(key.id, key.name)}
                >
                  <Trash />
                </Button>
              </Row>
            ))}
          </Rows>
        ) : (
          <Empty>No key yet. Create one for each agent or pipeline.</Empty>
        )}
      </Panel>

      <Panel title="Connected apps" count={apps.length}>
        {apps.length ? (
          <Rows>
            {apps.map((app) => (
              <Row
                key={app.id}
                title={app.name}
                meta={
                  <Mono>
                    {app.scopes.join(" · ") || "no permissions"} · connected{" "}
                    <LocalTime date={app.createdAt ?? new Date()} format={USED} />
                  </Mono>
                }
              >
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Disconnect ${app.name}`}
                  onClick={() => disconnect(app.id, app.name)}
                >
                  <Trash />
                </Button>
              </Row>
            ))}
          </Rows>
        ) : (
          <Empty>
            No app yet. Apps you connect by signing in — Claude, ChatGPT, Claude Code — show up
            here.
          </Empty>
        )}
      </Panel>

      <Panel
        title="Webhooks"
        count={webhooks.length}
        actions={
          <Button size="xs" variant="outline" onClick={addWebhook}>
            <Plus /> Add
          </Button>
        }
      >
        {webhooks.length ? (
          <Rows>
            {webhooks.map((hook) => (
              <Row
                key={hook.id}
                title={hook.description || hook.url}
                meta={
                  <Mono>
                    {hook.description ? `${hook.url} · ` : ""}
                    {hook.events.length === Object.keys(events).length
                      ? "all events"
                      : hook.events.join(" · ")}
                    {hook.lastDeliveryAt && (
                      <>
                        {" "}
                        · last {hook.lastStatus ?? "no answer"},{" "}
                        <LocalTime date={hook.lastDeliveryAt} format={USED} />
                      </>
                    )}
                  </Mono>
                }
                error={hook.lastError}
              >
                {!hook.enabled && <Badge variant="destructive">Off</Badge>}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={hook.enabled ? "Turn off" : "Turn back on"}
                  title={hook.enabled ? "Turn off" : "Turn back on"}
                  onClick={() => toggle(hook.id, !hook.enabled)}
                >
                  <Power />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Send a test event"
                  title="Send a test event"
                  onClick={() => test(hook.id)}
                >
                  <PaperPlaneTilt />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete webhook ${hook.url}`}
                  onClick={() => deleteWebhook(hook.id, hook.url)}
                >
                  <Trash />
                </Button>
              </Row>
            ))}
          </Rows>
        ) : (
          <Empty>
            No webhook yet. Add one to hear when posts go live or fail, instead of checking.
          </Empty>
        )}
      </Panel>
    </Page>
  );
}
