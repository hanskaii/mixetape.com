import { Drawer } from "@base-ui/react/drawer";
import type { ReactElement, ReactNode } from "react";

/**
 * A sheet that rises from the bottom of a phone's screen: Base UI's Drawer, swiped down or
 * tapped outside to close. `trigger` is the element that opens it.
 */
export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: ReactElement;
  /** Read by screen readers; the sheet shows its own heading if it needs one. */
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Trigger render={trigger} />
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
          <Drawer.Popup className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-popover px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-xl outline-none transition-transform duration-300 ease-out [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-[ending-style]:[transform:translateY(100%)] data-[starting-style]:[transform:translateY(100%)] data-[swiping]:duration-0">
            <div
              aria-hidden
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30"
            />
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
            <Drawer.Content>{children}</Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
