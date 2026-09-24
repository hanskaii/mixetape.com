import { Button } from "#/components/ui/button";
import {
  Modal,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "#/components/ui/modal";
import { Warning, SpinnerGap as Loader2 } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export interface ConfirmModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showModal?: boolean;
  setShowModal?: React.Dispatch<React.SetStateAction<boolean>>;
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  showModal,
  setShowModal,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const handleClose = () => {
    onCancel?.();
    setShowModal?.(false);
    onOpenChange?.(false);
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={onCancel}
      className="max-w-md"
    >
      <div className="flex flex-col gap-3">
        {variant === "destructive" && (
          <div className="size-10 rounded-full bg-destructive/10 ring-1 ring-destructive/20 flex items-center justify-center text-destructive">
            <Warning className="size-5" />
          </div>
        )}

        <ModalHeader className="pb-0">
          <ModalTitle className={variant === "destructive" ? "text-destructive" : ""}>
            {title}
          </ModalTitle>
          {description && <ModalDescription>{description}</ModalDescription>}
        </ModalHeader>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={handleClose}
            className="h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            disabled={loading}
            onClick={handleConfirm}
            className="h-8 px-4 text-xs font-semibold rounded-full cursor-pointer flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
