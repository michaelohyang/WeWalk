import type { Metadata } from "next";
import { loadRecoveryLink } from "@/server/pages";
import { Page } from "@/ui/Page";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Sign in on this phone" };

/**
 * A one-time recovery link, for a forgotten password. Opening it does nothing by itself (chat
 * apps open links to build previews); the button uses it up.
 */
export default async function RecoverPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const { link, signedInAs } = await loadRecoveryLink(token);
  return (
    <Page title={link ? `Sign in as ${link.name}` : "Sign in on this phone"}>
      <RecoverForm token={token} link={link} signedInAs={signedInAs} />
    </Page>
  );
}
