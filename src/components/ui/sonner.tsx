import { useEffect, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Info } from "@phosphor-icons/react/Info";
import { Warning } from "@phosphor-icons/react/Warning";
import { WarningCircle } from "@phosphor-icons/react/WarningCircle";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Spinner } from "#/components/ui/spinner";

/** The theme the page is in: the .dark class the theme toggle sets on <html>. */
function usePageTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/**
 * Toasts (shadcn/ui's Sonner), dressed in the app's tokens: paper surface, warm border,
 * the same icons as the rest of the interface. Mounted once, in the root layout.
 */
export function Toaster(props: ToasterProps) {
  const theme = usePageTheme();
  return (
    <Sonner
      theme={theme}
      icons={{
        success: <CheckCircle size={16} weight="fill" />,
        info: <Info size={16} />,
        warning: <Warning size={16} />,
        error: <WarningCircle size={16} weight="fill" />,
        loading: <Spinner size={16} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
