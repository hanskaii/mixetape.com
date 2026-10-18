import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trash } from "@phosphor-icons/react/Trash";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Spinner } from "#/components/ui/spinner";
import { deleteMyAccount } from "../-fn/account.fn";

/** Settings' last card: delete the account, confirmed by typing its email. */
export function DeleteAccount({ email }: { email: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const matches = Boolean(email) && typed.trim().toLowerCase() === email?.toLowerCase();

  const remove = async () => {
    setDeleting(true);
    setProblem(null);
    try {
      await deleteMyAccount({ data: { email: typed } });
      // The session went with the account: a full load leaves nothing of it behind.
      window.location.href = "/";
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "The account could not be deleted");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-destructive/25 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Delete account
          </h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Deletes your account and everything in it: channels and their access, posts, files,
            groups, brands, webhooks and API keys. Posts already published stay on their platforms.
            This cannot be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setTyped("");
            setProblem(null);
            setOpen(true);
          }}
        >
          <Trash /> Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Everything in your workspace is deleted for good. A plan that still renews must be
              cancelled in{" "}
              <Link to="/settings/billing" className="underline underline-offset-4">
                Billing
              </Link>{" "}
              first; invoices stay with our payment provider.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (matches) void remove();
            }}
          >
            <label htmlFor="delete-account-email" className="text-xs text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{email}</span> to confirm
            </label>
            <Input
              id="delete-account-email"
              type="email"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={email}
            />
            {problem && <p className="text-xs text-destructive">{problem}</p>}
            <Button type="submit" variant="destructive" disabled={!matches || deleting}>
              {deleting && <Spinner />} Delete account
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
