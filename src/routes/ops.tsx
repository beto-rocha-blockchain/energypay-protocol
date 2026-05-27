import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ops")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
