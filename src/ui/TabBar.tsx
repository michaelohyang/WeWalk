"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import styles from "./TabBar.module.css";

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Explore", icon: "explore", match: (p) => p === "/" || p.startsWith("/s/") },
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
  const station = path.match(/^\/s\/([^/]+)/)?.[1];
  const tab = (t: (typeof TABS)[number]) => (
    <Link
      key={t.href}
      href={t.href}
      className={styles.tab}
      aria-current={t.match(path) ? "page" : undefined}
    >
      <Icon name={t.icon} size={23} />
      <span>{t.label}</span>
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
