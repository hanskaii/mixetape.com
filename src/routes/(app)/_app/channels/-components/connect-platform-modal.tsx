import * as stylex from "@stylexjs/stylex";
import { CaretRight } from "@phosphor-icons/react";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { colors } from "../../../../../components/ui/tokens.stylex";
import { PlatformLogo } from "#/components/ui/platform-logo";

/** What a consent on each platform reaches, so the user knows which account to sign in with. */
const REACHES: Record<string, string> = {
  youtube: "Your YouTube channels",
  facebook: "Pages you manage",
  instagram: "A Business or Creator account",
  threads: "Your Threads profile",
  tiktok: "Your TikTok account",
  pinterest: "Your Pinterest account",
};

const styles = stylex.create({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  option: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover:not(:disabled)": colors.muted },
    borderRadius: "0.75rem",
    borderStyle: "none",
    color: colors.foreground,
    cursor: { default: "pointer", ":disabled": "default" },
    display: "flex",
    fontFamily: "inherit",
    gap: "0.75rem",
    opacity: { default: 1, ":disabled": 0.5 },
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    paddingBlock: "0.625rem",
    paddingInline: "0.75rem",
    textAlign: "start",
    width: "100%",
  },
  main: { display: "flex", flexDirection: "column", flexGrow: 1, gap: "0.125rem", minWidth: 0 },
  name: { fontSize: "0.875rem", fontWeight: 500 },
  reaches: { color: colors.mutedForeground, fontSize: "0.75rem" },
  trailing: { color: colors.mutedForeground, flexShrink: 0, fontSize: "0.75rem" },
});

/**
 * Picks the platform to connect a channel on. Choosing one hands off to the connect modal,
 * which opens that platform's consent screen. Opened through useModal().openModal.
 */
export function ConnectPlatformModal({
  providers,
  connectable,
  onChoose,
  onClose,
}: {
  providers: { id: string; name: string }[];
  /** The platforms mixetape has an app for; the rest are listed as coming. */
  connectable: string[];
  onChoose: (provider: string) => void;
  onClose: () => void;
}) {
  const ready = providers.filter((provider) => connectable.includes(provider.id));
  const coming = providers.filter((provider) => !connectable.includes(provider.id));

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} className="max-w-md">
      <ModalHeader>
        <ModalTitle>Connect a channel</ModalTitle>
        <ModalDescription>
          Pick the platform. A new tab opens there; sign in and allow access.
        </ModalDescription>
      </ModalHeader>
      <ul {...stylex.props(styles.list)}>
        {[...ready, ...coming].map((provider) => {
          const available = connectable.includes(provider.id);
          return (
            <li key={provider.id}>
              <button
                type="button"
                disabled={!available}
                // Synchronous with the click, so the consent tab is not blocked as a popup.
                onClick={() => onChoose(provider.id)}
                {...stylex.props(styles.option)}
              >
                <PlatformLogo provider={provider.id} size="md" />
                <span {...stylex.props(styles.main)}>
                  <span {...stylex.props(styles.name)}>{provider.name}</span>
                  <span {...stylex.props(styles.reaches)}>{REACHES[provider.id]}</span>
                </span>
                <span {...stylex.props(styles.trailing)}>
                  {available ? <CaretRight aria-hidden /> : "Soon"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
