import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@/ui/global.css";
import { THEME_BOOT_SCRIPT } from "@/ui/ThemeSwitch";

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "WeWalk", template: "%s · WeWalk" },
  description: "NYC WeWorks, rated by people who care too much.",
  // The link preview a group chat shows for an invite. Generic on purpose: no crew data.
  openGraph: {
    siteName: "WeWalk",
    title: "You're invited to the WeWalk crew",
    description: "NYC WeWorks, rated by people who care too much. Coffee, Wi-Fi, phone booths.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the keyboard shrinks the page, so sticky buttons stay above it.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e0e" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The boot script may set data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
