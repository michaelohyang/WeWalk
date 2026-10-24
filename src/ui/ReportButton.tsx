"use client";

import { useState } from "react";
import { fieldErrors, request } from "@/client/api";
import { CREW_HEADER, currentCrew } from "@/client/crew";
import { ConfirmDialog } from "./ConfirmDialog";
import forms from "./forms.module.css";
import styles from "./ReportButton.module.css";
import { useToast } from "./Toast";

/** "Report" under someone else's review or check-in: tells the crew's owner, with a reason. */
export function ReportButton({
  kind,
  id,
  by,
}: {
  kind: "review" | "checkin";
  id: string;
  /** Who wrote it, for the button's accessible name. */
  by: string;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Remounting the dialog closes it (it keeps its own open state).
  const [openKey, setOpenKey] = useState(0);
  const what = kind === "review" ? "review" : "check-in";

  async function report(e: React.MouseEvent) {
    e.preventDefault(); // stay open until it's sent, to show an error
    if (busy) return;
    setBusy(true);
    const crew = currentCrew();
    const res = await request(
      "POST",
      "/api/reports",
      { kind, id, reason },
      crew ? { [CREW_HEADER]: crew } : {},
    );
    setBusy(false);
    if (!res.ok) {
      // A problem with the reason stays in the dialog to fix; anything else closes it.
      const reasonError = fieldErrors(res.error).reason;
      if (reasonError) return setError(reasonError);
      toast(res.error.message);
      setOpenKey((k) => k + 1);
      return;
    }
    setReason("");
    setOpenKey((k) => k + 1);
    toast("Reported. The crew's owner will take a look.");
  }

  return (
    <ConfirmDialog
      key={openKey}
      trigger={
        <button type="button" className={styles.report} aria-label={`Report ${by}'s ${what}`}>
          Report
        </button>
      }
      title={`Report this ${what}?`}
      description="The crew's owner sees it, and that you reported it. They can take it out of the crew."
      confirmLabel={busy ? "Sending…" : "Report"}
      onConfirm={report}
    >
      <label className={forms.field}>
        <span>What&apos;s wrong with it? (optional)</span>
        <textarea
          className={forms.input}
          value={reason}
          maxLength={300}
          rows={3}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `report-error-${id}` : undefined}
        />
        {error && (
          <span id={`report-error-${id}`} className={forms.error} role="alert">
            {error}
          </span>
        )}
      </label>
    </ConfirmDialog>
  );
}
