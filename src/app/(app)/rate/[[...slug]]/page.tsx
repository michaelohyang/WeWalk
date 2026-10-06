import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadRate } from "@/server/pages";
import { RateForm } from "./rate-form";

export const metadata: Metadata = { title: "Rate" };

export default async function RatePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const segments = (await params).slug ?? [];
  if (segments.length > 1) notFound();
  const view = await loadRate(segments[0]);
  if (!view) return null; // signed out: the layout explains
  if (segments[0] && !view.stationSlug) notFound();
  // Remount when the station or edit target changes, so drafts load for the right one.
  return <RateForm key={`${view.stationSlug}:${view.existing?.id ?? "new"}`} view={view} />;
}
