import { getSession } from "@/server/session";
import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";
import { TabBar } from "@/ui/TabBar";

/** Everything in the app needs a signed-in phone. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    return (
      <Page
        title={
          <>
            We<span style={{ color: "var(--brand)" }}>Walk</span>
          </>
        }
        subtitle="NYC WeWorks, rated by people who care too much"
      >
        <Empty title="Members only.">
          This is a very exclusive coffee-snob society. Open the invite link your crew sent you, or
          ask them for one.
        </Empty>
      </Page>
    );
  }
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
