import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@/ui/global.css";
import { THEME_BOOT_SCRIPT } from "@/ui/ThemeSwitch";

export const metadata: Metadata = {
  title: { default: "WeWalk", template: "%s · WeWalk" },
  description: "NYC WeWorks, rated by people who care too much.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
