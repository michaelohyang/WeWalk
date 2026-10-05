import type { Metadata } from "next";
import { loadPair } from "@/server/pages";
import { Page } from "@/ui/Page";
import { PairForm } from "./pair-form";

export const metadata: Metadata = { title: "Sign in on this phone" };

/**
 * A one-time pairing or recovery link. Opening it does nothing by itself (chat apps open links
 * to build previews); the button uses it up.
 */
export default async function PairPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const { link, signedInAs } = await loadPair(token);
  return (
    <Page title={link ? `Sign in as ${link.name}` : "Sign in on this phone"}>
      <PairForm token={token} link={link} signedInAs={signedInAs} />
    </Page>
  );
}
