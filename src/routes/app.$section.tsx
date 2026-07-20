import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/app/$section")({
  loader: () => {
    throw notFound();
  },
  component: () => null,
});