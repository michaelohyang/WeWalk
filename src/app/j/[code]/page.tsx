import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadJoin } from "@/server/pages";
import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join the crew" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  let code: string;
  try {
    code = decodeURIComponent((await params).code);
  } catch {
    code = ""; // a mangled link: treated like any other wrong code
  }
  const join = await loadJoin(code);
  if (join.signedIn) redirect("/");
  if (!join.valid) {
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
      <JoinForm code={code} members={join.members} />
    </Page>
  );
}
