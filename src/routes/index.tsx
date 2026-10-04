import { createFileRoute } from "@tanstack/react-router";
import { Bouncekeep } from "@/components/bouncekeep";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Bouncekeep />;
}
