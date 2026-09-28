import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import * as stylex from "@stylexjs/stylex";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  DotsThree,
  Plus,
  LinkBreak,
  PencilSimple,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
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
import { getChannelsData, removeAccount, removeBrand } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";
import { BrandModal } from "./-components/brand-modal";
import { ConnectPlatformModal } from "./-components/connect-platform-modal";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { PlatformLogo } from "#/components/ui/platform-logo";
import { channelUrl } from "./-lib/channel-url";

export const Route = createFileRoute("/(app)/_app/channels/")({
  validateSearch: z.object({ connected: z.string().optional(), error: z.string().optional() }),
  loader: () => getChannelsData(),
  head: () => ({ meta: [{ title: `Channels | ${siteConfig.name}` }] }),
  component: ChannelsPage,
});

const styles = stylex.create({
  actions: { alignItems: "center", display: "flex", gap: "0.25rem" },
  avatars: { display: "flex", marginInlineEnd: "0.25rem" },
  stacked: { marginInlineStart: { default: "-0.375rem", ":first-child": 0 } },
});

function ChannelsPage() {
  const router = useRouter();
  const { providers, connectable, accounts, brands } = Route.useLoaderData();
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

  const editBrand = (brand?: (typeof brands)[number]) =>
    openModal(
      <BrandModal
        brand={brand}
        channels={accounts}
        platformName={nameOf}
        onClose={closeModal}
        onSaved={refresh}
      />,
    );

  const deleteBrand = (id: string, name: string) =>
    confirm({
      title: "Delete this brand?",
      description: `"${name}" goes; its channels stay connected.`,
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        await removeBrand({ data: { id } });
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
                    <ChannelAvatar
                      provider={account.provider}
                      avatar={account.avatar}
                      name={account.name}
                    />
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
                    <ChannelMenu
                      name={account.name}
                      platform={group.name}
                      url={channelUrl(account)}
                      onRefresh={() => connect(account.provider, account.name)}
                      onDisconnect={() => disconnect(account.id, account.name)}
                    />
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

      {accounts.length > 0 && (
        <Panel
          title="Brands"
          count={brands.length}
          actions={
            <Button size="xs" variant="ghost" onClick={() => editBrand()}>
              <Plus /> New brand
            </Button>
          }
        >
          {brands.length ? (
            <Rows>
              {brands.map((brand) => {
                const members = accounts.filter((account) => brand.accountIds.includes(account.id));
                return (
                  <Row
                    key={brand.id}
                    title={brand.name}
                    meta={
                      members.length
                        ? members.map((account) => account.name).join(", ")
                        : "No channel yet"
                    }
                  >
                    <span {...stylex.props(styles.actions)}>
                      <span {...stylex.props(styles.avatars)}>
                        {members.slice(0, 5).map((account) => (
                          <span key={account.id} {...stylex.props(styles.stacked)}>
                            <ChannelAvatar
                              provider={account.provider}
                              avatar={account.avatar}
                              name={account.name}
                              size="sm"
                            />
                          </span>
                        ))}
                      </span>
                      <BrandMenu
                        name={brand.name}
                        onEdit={() => editBrand(brand)}
                        onDelete={() => deleteBrand(brand.id, brand.name)}
                      />
                    </span>
                  </Row>
                );
              })}
            </Rows>
          ) : (
            <Empty>
              Group the channels one show or business posts to — its YouTube channel and its
              Facebook Page, say — so content can go to the brand at once.
            </Empty>
          )}
        </Panel>
      )}
    </Page>
  );
}

/** A channel's actions: see it on its platform, sign in to it again, or remove it. */
function ChannelMenu({
  name,
  platform,
  url,
  onRefresh,
  onDisconnect,
}: {
  name: string;
  platform: string;
  url: string | null;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${name}`}>
            <DotsThree weight="bold" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        {url && (
          <DropdownMenuItem render={<a href={url} target="_blank" rel="noreferrer" />}>
            <ArrowSquareOut /> View on {platform}
          </DropdownMenuItem>
        )}
        {/* Opens the platform's consent again: new tokens, and any permission it now lacks. */}
        <DropdownMenuItem onClick={onRefresh}>
          <ArrowsClockwise /> Refresh connection
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDisconnect}>
          <LinkBreak /> Disconnect channel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BrandMenu({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${name}`}>
            <DotsThree weight="bold" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={onEdit}>
          <PencilSimple /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
