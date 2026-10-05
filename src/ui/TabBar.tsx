"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import styles from "./TabBar.module.css";

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  {
    href: "/",
    label: "Explore",
    icon: "explore",
    match: (p) => p === "/" || p.startsWith("/stations/"),
  },
  { href: "/ranks", label: "Ranks", icon: "ranks", match: (p) => p.startsWith("/ranks") },
  {
    href: "/passport",
    label: "Passport",
    icon: "passport",
    match: (p) => p.startsWith("/passport"),
  },
  { href: "/crew", label: "Crew", icon: "crew", match: (p) => p.startsWith("/crew") },
];

/** Bottom navigation. The middle button starts a review (for the station you're on, if any). */
export function TabBar() {
  const path = usePathname();
  // The rate form gets the whole screen (and the keyboard's room) for its Post button.
  if (path.startsWith("/rate")) return null;
  const station = path.match(/^\/stations\/([^/]+)/)?.[1];
  const tab = (t: (typeof TABS)[number]) => (
    <Link
      key={t.href}
      href={t.href}
      className={styles.tab}
      aria-current={t.match(path) ? "page" : undefined}
    >
      <TabContent icon={t.icon} label={t.label} />
    </Link>
  );
  return (
    <nav className={styles.bar} aria-label="Main">
      <div className={styles.inner}>
        {TABS.slice(0, 2).map(tab)}
        <Link
          href={station ? `/rate/${station}` : "/rate"}
          className={styles.plus}
          aria-label="Rate a station"
        >
          <Icon name="plus" size={24} />
        </Link>
        {TABS.slice(2).map(tab)}
      </div>
    </nav>
  );
}

/** The tapped tab lights up right away while its screen loads (no waiting on the server). */
function TabContent({ icon, label }: { icon: IconName; label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={pending ? `${styles.content} ${styles.pending}` : styles.content}>
      <Icon name={icon} size={23} />
      <span>{label}</span>
    </span>
  );
}
