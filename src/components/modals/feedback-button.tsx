import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Spinner } from "#/components/ui/spinner";
import { Textarea } from "#/components/ui/textarea";
import { sendFeedback } from "#/modules/feedback/feedback.fn";

/** A page's feedback button: what is written goes to mixetape's inbox by email. */
export function FeedbackButton() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await sendFeedback({ data: { message, page: pathname } });
      toast.success("Thanks — we read every message.");
      setMessage("");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Give feedback"
        title="Give feedback"
        onClick={() => setOpen(true)}
      >
        <ChatCircleDots size={19} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share feedback</DialogTitle>
            <DialogDescription>
              Tell us what would make publishing easier. It goes straight to our inbox, and we reply
              to your email.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Textarea
              aria-label="Your feedback"
              placeholder="Your feedback…"
              rows={5}
              maxLength={5000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <Button type="submit" disabled={sending || !message.trim()}>
              {sending && <Spinner />} Send feedback
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
