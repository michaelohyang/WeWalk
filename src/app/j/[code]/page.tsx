import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isInviteCode } from "@/server/services/auth";
import { getSession } from "@/server/session";
import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join the crew" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (await getSession()) redirect("/");
  const code = decodeURIComponent((await params).code);
  if (!isInviteCode(code, process.env.CREW_CODE)) {
    return (
      <Page title="Hmm.">
        <Empty title="That invite link doesn't work.">
          It may be old or mistyped. Ask whoever sent it for a fresh one.
        </Empty>
      </Page>
    );
  }
  return (
    <Page title="Join the crew" subtitle="NYC WeWorks, rated by people who care too much">
      <JoinForm code={code} />
    </Page>
  );
}
