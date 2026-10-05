"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flush, subscribe, waiting, type Job } from "@/client/outbox";
import styles from "./OutboxStatus.module.css";
import { useToast } from "./Toast";

/**
 * Mounted once in the app: retries queued writes when the phone gets signal back, the app
 * opens, or the tab comes back to the front, and shows what's still waiting.
 */
export function OutboxStatus() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = subscribe(setJobs);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read storage once on mount
    setJobs(waiting());
    const retry = () => {
      if (!waiting().length) return;
      const before = waiting().length;
      const refused: string[] = [];
      void flush((job, result) => {
        refused.push(
          `${job.label} didn't post: ${result.error.message}` +
            (job.draft ? " What you wrote is still in the form." : ""),
        );
      }).then(() => {
        if (waiting().length >= before) return;
        // One toast at a time: a refusal matters more than "all good".
        toast(refused.length ? refused.join(" ") : "Back online. Your updates are posted.");
        router.refresh();
      });
    };
    retry();
    // "online" fires as soon as the phone sees a network, often a moment before requests get
    // through (lobby wifi, captive portals). Try again shortly instead of waiting for the timer.
    const soon: ReturnType<typeof setTimeout>[] = [];
    const onOnline = () => {
      soon.splice(0).forEach(clearTimeout);
      retry();
      for (const ms of [1_000, 3_000, 7_000]) soon.push(setTimeout(retry, ms));
    };
    const onVisible = () => document.visibilityState === "visible" && retry();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(retry, 30_000);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      soon.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [router, toast]);

  if (!jobs.length) return null;
  return (
    <div className={styles.bar} role="status">
      {jobs.length === 1
        ? `${jobs[0]!.label} is saved on this phone`
        : `${jobs.length} updates are saved on this phone`}
      , and will post when you&apos;re back online.
    </div>
  );
}
