import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback, useMemo, memo } from "react";
import { ConfirmModal, type ConfirmModalProps } from "#/components/modals/confirm-modal";
import { LoginModal, type LoginModalProps } from "#/components/modals/login-modal";

export interface ConfirmOptions extends Omit<
  ConfirmModalProps,
  "open" | "onOpenChange" | "showModal" | "setShowModal"
> {}

export interface ModalContextType {
  // Confirm Modal API
  confirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;

  // Login Modal API
  openLogin: (props?: Partial<LoginModalProps>) => void;
  closeLogin: () => void;

  // Custom generic modal API
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
}

export const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  return <ModalProviderClient>{children}</ModalProviderClient>;
}

const ModalProviderClient = memo(function ModalProviderClient({
  children,
}: {
  children: ReactNode;
}) {
  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
  }>({
    open: false,
    options: null,
  });

  // Login modal state
  const [loginState, setLoginState] = useState<{
    open: boolean;
    props: Partial<LoginModalProps> | null;
  }>({
    open: false,
    props: null,
  });

  // Generic custom modal state
  const [customModal, setCustomModal] = useState<ReactNode | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      open: true,
      options,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, open: false }));
  }, []);

  const openLogin = useCallback((props?: Partial<LoginModalProps>) => {
    setLoginState({
      open: true,
      props: props || null,
    });
  }, []);

  const closeLogin = useCallback(() => {
    setLoginState((prev) => ({ ...prev, open: false }));
  }, []);

  const openModal = useCallback((content: ReactNode) => {
    setCustomModal(content);
  }, []);

  const closeModal = useCallback(() => {
    setCustomModal(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      confirm,
      closeConfirm,
      openLogin,
      closeLogin,
      openModal,
      closeModal,
    }),
    [confirm, closeConfirm, openLogin, closeLogin, openModal, closeModal],
  );

  return (
    <ModalContext.Provider value={contextValue}>
      {children}

      {/* Global Confirm Modal */}
      {confirmState.options && (
        <ConfirmModal
          {...confirmState.options}
          open={confirmState.open}
          onOpenChange={(open) => {
            if (!open) closeConfirm();
          }}
          onConfirm={async () => {
            try {
              await confirmState.options?.onConfirm();
            } finally {
              closeConfirm();
            }
          }}
          onCancel={() => {
            confirmState.options?.onCancel?.();
            closeConfirm();
          }}
        />
      )}

      {/* Global Login Modal */}
      <LoginModal
        {...loginState.props}
        open={loginState.open}
        onOpenChange={(open) => {
          if (!open) closeLogin();
        }}
        onSuccess={() => {
          loginState.props?.onSuccess?.();
          closeLogin();
        }}
      />

      {/* Global Generic Modal Container */}
      {customModal}
    </ModalContext.Provider>
  );
});

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

export function useConfirmModal() {
  const { confirm, closeConfirm } = useModal();
  return { confirm, closeConfirm };
}
