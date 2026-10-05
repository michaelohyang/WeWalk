"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "./Icon";

/*
 * Back that behaves like the browser's when it safely can: it returns to the exact screen you
 * came from (filters, scroll and all). It only does that when the previous history entry is
 * WeWalk; otherwise it links to the last list you looked at, or `fallback`.
 */

// The last list screen (Explore, Ranks, Passport, Crew) seen in this tab, with its filters.
let lastList: string | null = null;

function Tracker() {
  const path = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    if (!path.startsWith("/s/") && !path.startsWith("/rate"))
      lastList = query ? `${path}?${query}` : path;
  }, [path, query]);
  return null;
}

/** Mount once in the app layout. */
export function NavTracker() {
  return (
    <Suspense>
      <Tracker />
    </Suspense>
  );
}

/** True when the previous history entry is a WeWalk page (Navigation API, where supported). */
function previousEntryIsOurs(): boolean {
  const nav = (
    window as {
      navigation?: { currentEntry?: { index: number }; entries(): { url: string | null }[] };
    }
  ).navigation;
  const index = nav?.currentEntry?.index;
  if (!nav || index === undefined || index < 1) return false;
  const url = nav.entries()[index - 1]?.url;
  return !!url && new URL(url).origin === location.origin;
}

export function BackLink({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  const [href, setHref] = useState(fallback);
  // Reading module state after mount keeps server and client markup identical.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHref(lastList ?? fallback), [fallback]);
  return (
    <Link
      href={href}
      className={className}
      aria-label="Back"
      onClick={(e) => {
        if (previousEntryIsOurs()) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <Icon name="back" size={20} />
    </Link>
  );
}
