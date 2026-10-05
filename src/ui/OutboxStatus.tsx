"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flush, pending, subscribe, type Job } from "@/client/outbox";
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
    setJobs(pending());
    const retry = () => {
      if (!pending().length) return;
      const before = pending().length;
      void flush((job, result) => toast(`${job.label} didn't post: ${result.error.message}`)).then(
        () => {
          if (pending().length < before) {
            toast("Back online. Your updates are posted.");
            router.refresh();
          }
        },
      );
    };
    retry();
    const onVisible = () => document.visibilityState === "visible" && retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(retry, 30_000);
    return () => {
      unsubscribe();
      window.removeEventListener("online", retry);
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
