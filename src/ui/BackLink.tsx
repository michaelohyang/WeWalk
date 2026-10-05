"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";

// Screens visited in this tab since the app loaded. Module state survives client navigations.
let screensVisited = 0;

/** Mount once in the app layout: counts in-app navigations so Back knows it can go back. */
export function NavTracker() {
  const path = usePathname();
  useEffect(() => {
    screensVisited++;
  }, [path]);
  return null;
}

/**
 * Back that behaves like the browser's: returns to the exact screen you came from (filters,
 * scroll and all). Opened straight from a shared link, it goes to `fallback` instead.
 */
export function BackLink({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      aria-label="Back"
      onClick={(e) => {
        if (screensVisited > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <Icon name="back" size={20} />
    </Link>
  );
}
