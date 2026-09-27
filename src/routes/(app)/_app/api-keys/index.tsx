import { createFileRoute, useRouter } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { colors } from "../../../../components/ui/tokens.stylex";
import {
  Empty,
  Mono,
  Page,
  PageHeader,
  Panel,
  Row,
  Rows,
} from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { CreateApiKeyModal } from "#/components/modals/create-api-key-modal";
import { getApiKeys, removeApiKey } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/api-keys/")({
  loader: () => getApiKeys(),
  head: () => ({ meta: [{ title: `API keys | ${siteConfig.name}` }] }),
  component: ApiKeysPage,
});

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
  const { keys, scopes, baseUrl } = Route.useLoaderData();
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
            {`claude mcp add --transport http mixetape ${baseUrl}/mcp \\\n  --header "Authorization: Bearer mxt_…"`}
          </pre>
          <p {...stylex.props(styles.hint)}>
            Or REST: <Mono>GET {baseUrl}/api/v1/tools</Mono> lists what the key may do,{" "}
            <Mono>POST /api/v1/tools/:name</Mono> runs a tool.
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
                    {key.lastUsedAt
                      ? `used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "never used"}
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
    </Page>
  );
}
