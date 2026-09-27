import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import * as stylex from "@stylexjs/stylex";
import {
  Check,
  Key,
  Plus,
  PlugsConnected,
  Trash,
  WarningCircle,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Empty,
  Mono,
  Notice,
  Page,
  PageHeader,
  Panel,
  Row,
  Rows,
} from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { AddCredentialModal } from "#/components/modals/add-credential-modal";
import { CredentialSecretModal } from "#/components/modals/credential-secret-modal";
import { getChannelsData, removeAccount, removeCredential } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/channels/")({
  validateSearch: z.object({ connected: z.string().optional(), error: z.string().optional() }),
  loader: () => getChannelsData(),
  head: () => ({ meta: [{ title: `Channels | ${siteConfig.name}` }] }),
  component: ChannelsPage,
});

const styles = stylex.create({
  avatar: {
    borderRadius: "9999px",
    flexShrink: 0,
    height: "2rem",
    objectFit: "cover",
    width: "2rem",
  },
  youtube: { color: "#ef4444", flexShrink: 0, fontSize: "2rem" },
  actions: { alignItems: "center", display: "flex", gap: "0.25rem" },
});

function ChannelsPage() {
  const router = useRouter();
  const { credentials, accounts, providers, redirectUris } = Route.useLoaderData();
  const { connected, error } = Route.useSearch();
  const { confirm } = useConfirmModal();
  const { openConnectChannel, openModal, closeModal } = useModal();
  const refresh = () => router.invalidate();

  const labelOf = (credentialId: string) =>
    credentials.find((credential) => credential.id === credentialId)?.label ??
    "your app credential";

  const connect = (credentialId: string, channel?: string) =>
    openConnectChannel({
      credentialId,
      credentialLabel: labelOf(credentialId),
      channel,
      onConnected: async (channels) => {
        await router.navigate({ to: "/channels", search: { connected: channels.join(", ") } });
        await refresh();
      },
    });

  const addCredential = () =>
    openModal(
      <AddCredentialModal
        providers={providers}
        redirectUris={redirectUris}
        onClose={closeModal}
        onSaved={refresh}
      />,
    );

  const updateSecret = (credentialId: string, label: string) =>
    openModal(
      <CredentialSecretModal
        credentialId={credentialId}
        label={label}
        onClose={closeModal}
        onSaved={refresh}
      />,
    );

  const remove = (kind: "credential" | "account", id: string, name: string) =>
    confirm({
      title: kind === "credential" ? "Remove this app credential?" : "Disconnect this channel?",
      description:
        kind === "credential"
          ? `"${name}" and every channel connected through it will be removed, with their scheduled posts.`
          : `"${name}" and its scheduled posts will be removed. Posts already on the platform stay there.`,
      confirmText: "Remove",
      variant: "destructive",
      onConfirm: async () => {
        await (kind === "credential"
          ? removeCredential({ data: { id } })
          : removeAccount({ data: { id } }));
        await refresh();
      },
    });

  return (
    <Page>
      <PageHeader
        title="Channels"
        description="Where agents can post, connected through your own OAuth apps."
        actions={
          <Button size="sm" variant="outline" onClick={addCredential}>
            <Plus /> App credential
          </Button>
        }
      />

      {connected && (
        <Notice tone="success">
          <Check /> Connected: {connected}
        </Notice>
      )}
      {error && (
        <Notice tone="danger">
          <WarningCircle /> {error}
        </Notice>
      )}

      <Panel title="Channels" count={accounts.length}>
        {accounts.length ? (
          <Rows>
            {accounts.map((account) => (
              <Row
                key={account.id}
                leading={
                  account.avatar ? (
                    <img src={account.avatar} alt="" {...stylex.props(styles.avatar)} />
                  ) : (
                    <YoutubeLogo weight="fill" {...stylex.props(styles.youtube)} />
                  )
                }
                title={account.name}
                meta={`${account.handle ?? account.platformAccountId} · ${labelOf(account.credentialId)}`}
              >
                <span {...stylex.props(styles.actions)}>
                  {account.status === "active" ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Button size="xs" onClick={() => connect(account.credentialId, account.name)}>
                      Reconnect
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Disconnect ${account.name}`}
                    onClick={() => remove("account", account.id, account.name)}
                  >
                    <Trash />
                  </Button>
                </span>
              </Row>
            ))}
          </Rows>
        ) : (
          <Empty>
            {credentials.length
              ? "No channel yet — connect one through an app credential below."
              : "No channel yet — add an app credential first, then connect a channel through it."}
          </Empty>
        )}
      </Panel>

      <Panel title="App credentials" count={credentials.length}>
        {credentials.length ? (
          <Rows>
            {credentials.map((credential) => (
              <Row
                key={credential.id}
                title={credential.label}
                meta={
                  <Mono>
                    {credential.provider} · {credential.clientId}
                  </Mono>
                }
              >
                <span {...stylex.props(styles.actions)}>
                  <Button size="xs" variant="outline" onClick={() => connect(credential.id)}>
                    <PlugsConnected /> Connect
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Update the secret of ${credential.label}`}
                    title="Update secret"
                    onClick={() => updateSecret(credential.id, credential.label)}
                  >
                    <Key />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${credential.label}`}
                    onClick={() => remove("credential", credential.id, credential.label)}
                  >
                    <Trash />
                  </Button>
                </span>
              </Row>
            ))}
          </Rows>
        ) : (
          <Empty>No app credential yet.</Empty>
        )}
      </Panel>
    </Page>
  );
}
