import { redirect } from "next/navigation";
import { safeNext } from "@/domain/redirect";
import { isSignedIn } from "@/server/pages";
import { Page } from "@/ui/Page";
import { AuthForm } from "./auth-form";

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: "login" | "signup";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const code = typeof params.code === "string" ? params.code : undefined;
  if (await isSignedIn()) redirect(next);
  return (
    <Page
      title={mode === "signup" ? "Join WeWalk" : "Log in"}
      subtitle="NYC WeWorks, rated by people who care too much"
    >
      <AuthForm mode={mode} next={next} code={code} />
    </Page>
  );
}
