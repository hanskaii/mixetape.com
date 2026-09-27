import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import * as stylex from "@stylexjs/stylex";
import { Check, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Empty,
  Notice,
  Page,
  PageHeader,
  Panel,
  Row,
  Rows,
} from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { getChannelsData, removeAccount } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";
import { ConnectPlatformModal } from "./-components/connect-platform-modal";
import { PlatformLogo } from "./-components/platform-logo";

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
  actions: { alignItems: "center", display: "flex", gap: "0.25rem" },
});

function ChannelsPage() {
  const router = useRouter();
  const { providers, connectable, accounts } = Route.useLoaderData();
  const { connected, error } = Route.useSearch();
  const { confirm } = useConfirmModal();
  const { openConnectChannel, openModal, closeModal } = useModal();
  const refresh = () => router.invalidate();

  const nameOf = (provider: string) =>
    providers.find((platform) => platform.id === provider)?.name ?? provider;

  const connect = (provider: string, channel?: string) =>
    openConnectChannel({
      provider,
      platform: nameOf(provider),
      channel,
      onConnected: async (channels) => {
        await router.navigate({ to: "/channels", search: { connected: channels.join(", ") } });
        await refresh();
      },
    });

  const choosePlatform = () =>
    openModal(
      <ConnectPlatformModal
        providers={providers}
        connectable={connectable}
        onChoose={(provider) => {
          closeModal();
          connect(provider);
        }}
        onClose={closeModal}
      />,
    );

  const disconnect = (id: string, name: string) =>
    confirm({
      title: "Disconnect this channel?",
      description: `"${name}" and its scheduled posts will be removed. Posts already on the platform stay there.`,
      confirmText: "Disconnect",
      variant: "destructive",
      onConfirm: async () => {
        await removeAccount({ data: { id } });
        await refresh();
      },
    });

  // One panel per platform that has channels, in the platforms' own order.
  const groups = providers
    .map((platform) => ({
      ...platform,
      accounts: accounts.filter((account) => account.provider === platform.id),
    }))
    .filter((group) => group.accounts.length);

  return (
    <Page>
      <PageHeader
        title="Channels"
        description="Where your agents can post."
        actions={
          <Button size="sm" onClick={choosePlatform}>
            <Plus /> Connect
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

      {groups.length ? (
        groups.map((group) => (
          <Panel
            key={group.id}
            icon={<PlatformLogo provider={group.id} size="sm" />}
            title={group.name}
            count={group.accounts.length}
          >
            <Rows>
              {group.accounts.map((account) => (
                <Row
                  key={account.id}
                  leading={
                    account.avatar ? (
                      <img src={account.avatar} alt="" {...stylex.props(styles.avatar)} />
                    ) : (
                      <PlatformLogo provider={account.provider} />
                    )
                  }
                  title={account.name}
                  meta={account.handle ?? account.platformAccountId}
                >
                  <span {...stylex.props(styles.actions)}>
                    {account.status === "active" ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Button size="xs" onClick={() => connect(account.provider, account.name)}>
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Disconnect ${account.name}`}
                      onClick={() => disconnect(account.id, account.name)}
                    >
                      <Trash />
                    </Button>
                  </span>
                </Row>
              ))}
            </Rows>
          </Panel>
        ))
      ) : (
        <Panel>
          <Empty>No channel yet. Press Connect and pick a platform.</Empty>
        </Panel>
      )}
    </Page>
  );
}
