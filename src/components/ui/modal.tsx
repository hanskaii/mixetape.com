import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";

import { colors, radius } from "./tokens.stylex";
import { customClassName } from "./stylex-utils";

const styles = stylex.create({
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgb(0 0 0 / 60%)",
    backdropFilter: "blur(4px)",
    opacity: 0,
    transition: "opacity 150ms ease",
  },
  backdropOpen: { opacity: 1 },
  popup: {
    position: "fixed",
    left: "50%",
    top: "50%",
    width: "calc(100% - 2rem)",
    maxWidth: "32rem",
    transform: "translate(-50%, -50%) scale(.95)",
    borderRadius: radius["2xl"],
    backgroundColor: colors.card,
    boxShadow: "0 25px 50px -12px rgb(0 0 0 / 25%)",
    outline: "none",
    padding: "1.5rem",
    opacity: 0,
    transition: "opacity 150ms ease, transform 150ms ease",
  },
  popupOpen: { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: ".375rem",
    textAlign: "left",
    paddingBottom: ".5rem",
  },
  footer: {
    display: "flex",
    flexDirection: "column-reverse",
    gap: ".5rem",
    justifyContent: "flex-end",
    paddingTop: "1rem",
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    borderTopColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    marginTop: "1rem",
    "@media (min-width: 640px)": { flexDirection: "row" },
  },
  title: {
    fontWeight: 700,
    fontSize: "1rem",
    lineHeight: 1.25,
    letterSpacing: "-.025em",
    color: colors.foreground,
  },
  description: { color: colors.mutedForeground, fontSize: ".75rem", lineHeight: 1.625 },
  close: {
    position: "absolute",
    top: "1rem",
    right: "1rem",
    padding: ".25rem",
    borderRadius: radius.md,
    cursor: "pointer",
    opacity: { ":hover": 1, default: 0.7 },
    transition: "opacity 150ms ease",
  },
});

export interface ModalProps {
  children: React.ReactNode;
  className?: string;
  showModal?: boolean;
  setShowModal?: React.Dispatch<React.SetStateAction<boolean>>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  preventDefaultClose?: boolean;
  backdropClassName?: string;
  zIndex?: number;
}

export function Modal({
  children,
  className,
  showModal,
  setShowModal,
  open,
  onOpenChange,
  onClose,
  preventDefaultClose,
  backdropClassName,
  zIndex = 100,
}: ModalProps) {
  const isControlled = open !== undefined || showModal !== undefined;
  const isOpen = open ?? showModal ?? true;

  const handleClose = React.useCallback(() => {
    if (preventDefaultClose) return;
    onClose?.();
    setShowModal?.(false);
    onOpenChange?.(false);
  }, [preventDefaultClose, onClose, setShowModal, onOpenChange]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) handleClose();
      else {
        setShowModal?.(true);
        onOpenChange?.(true);
      }
    },
    [handleClose, setShowModal, onOpenChange],
  );

  return (
    <DialogPrimitive.Root
      open={isControlled ? isOpen : undefined}
      defaultOpen={!isControlled ? true : undefined}
      onOpenChange={handleOpenChange}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={(state) =>
            stylex.props(
              styles.backdrop,
              state.open && styles.backdropOpen,
              customClassName(backdropClassName),
            ).className
          }
          style={{ zIndex }}
        />
        <DialogPrimitive.Popup
          className={(state) =>
            stylex.props(styles.popup, state.open && styles.popupOpen, customClassName(className))
              .className
          }
          style={{ zIndex: zIndex + 1 }}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...stylex.props(styles.header, customClassName(className))} {...props} />;
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...stylex.props(styles.footer, customClassName(className))} {...props} />;
}

export function ModalTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title {...stylex.props(styles.title, customClassName(className))} {...props} />
  );
}

export function ModalDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogPrimitive.Description
      {...stylex.props(styles.description, customClassName(className))}
      {...props}
    />
  );
}

export function ModalClose({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <DialogPrimitive.Close {...stylex.props(styles.close, customClassName(className))} {...props} />
  );
}
