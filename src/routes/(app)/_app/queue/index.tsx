import { createFileRoute, redirect } from "@tanstack/react-router";

// The Queue page is now Publish; old links and bookmarks land there.
export const Route = createFileRoute("/(app)/_app/queue/")({
  beforeLoad: () => {
    throw redirect({ to: "/publish", statusCode: 301 });
  },
});
