import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@/ui/global.css";

export const metadata: Metadata = {
  title: "WeWalk",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
