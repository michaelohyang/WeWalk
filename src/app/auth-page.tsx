import { redirect } from "next/navigation";
import { isSignedIn } from "@/server/pages";
import { Page } from "@/ui/Page";
import { AuthForm } from "./auth-form";

/** Only same-site paths: never bounce someone to another site after logging in. */
const safeNext = (next: string | string[] | undefined) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: "login" | "signup";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await isSignedIn()) redirect(next);
  return (
    <Page
      title={mode === "signup" ? "Join WeWalk" : "Log in"}
      subtitle="NYC WeWorks, rated by people who care too much"
    >
      <AuthForm mode={mode} next={next} />
    </Page>
  );
}
