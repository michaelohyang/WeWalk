import type { Metadata } from "next";
import { getSession } from "@/server/session";
import { Page } from "@/ui/Page";
import { PairForm } from "./pair-form";

export const metadata: Metadata = { title: "Sign in on this phone" };

/**
 * A one-time pairing or recovery link. Opening it does nothing by itself (chat apps open links
 * to build previews); the button uses it up.
 */
export default async function PairPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getSession();
  return (
    <Page title="Sign in on this phone">
      <PairForm token={(await params).token} signedInAs={session?.member.name ?? null} />
    </Page>
  );
}
