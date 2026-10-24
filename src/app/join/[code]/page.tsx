import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadJoin } from "@/server/pages";
import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Join a crew" };

/**
 * A crew's invite link. Signed out: sign up with the code (you land in the crew). Signed in: a
 * button joins, so opening a link alone never adds you to a crew.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await loadJoin(code);
  if (!view.signedIn) redirect(`/signup?code=${encodeURIComponent(code)}`);
  if (!view.crew) {
    return (
      <Page title="Join a crew" home>
        <Empty title="That invite link doesn't work any more.">
          Ask whoever sent it for a new one.
        </Empty>
      </Page>
    );
  }
  return (
    <Page title={`Join ${view.crew.name}?`} subtitle="Their feed, rankings and check-ins" home>
      <JoinButton code={code} />
    </Page>
  );
}
