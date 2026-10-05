import { getSession } from "@/server/session";
import { AuthForm } from "../auth-form";
import { NavTracker } from "@/ui/BackLink";
import { OutboxStatus } from "@/ui/OutboxStatus";
import { ToastProvider } from "@/ui/Toast";
import { Page } from "@/ui/Page";
import { TabBar } from "@/ui/TabBar";

/** Everything in the app needs you logged in. Signed out, any page shows the login form, and
 * logging in reloads that same page. */
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
        <AuthForm mode="login" />
      </Page>
    );
  }
  return (
    <ToastProvider>
      <NavTracker />
      {children}
      <OutboxStatus />
      <TabBar />
    </ToastProvider>
  );
}
