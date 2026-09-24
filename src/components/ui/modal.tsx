import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "./utils";

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
      if (!nextOpen) {
        handleClose();
      } else {
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
          className={cn(
            "fixed inset-0 bg-black/60 backdrop-blur-sm data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 duration-150",
            backdropClassName,
          )}
          style={{ zIndex }}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card ring-1 ring-foreground/10 p-6 shadow-2xl data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 duration-150 focus:outline-none",
            className,
          )}
          style={{ zIndex: zIndex + 1 }}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-left pb-2", className)} {...props} />;
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border/60 mt-4",
        className,
      )}
      {...props}
    />
  );
}

export function ModalTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-bold text-base leading-tight tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function ModalDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-xs leading-relaxed", className)}
      {...props}
    />
  );
}

export function ModalClose({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <DialogPrimitive.Close
      className={cn(
        "absolute top-4 right-4 rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-1 cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}
