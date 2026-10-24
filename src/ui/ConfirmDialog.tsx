"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import btn from "./Button.module.css";
import styles from "./ConfirmDialog.module.css";

/**
 * Asks before something that can't be undone. Focus moves into the dialog (onto the safe
 * choice) and back to the trigger when it closes; Escape cancels.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: {
  /** The button that opens the dialog. */
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.dialog}>
          <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            {description}
          </AlertDialog.Description>
          <div className={styles.actions}>
            <AlertDialog.Cancel className={`${btn.btn} ${btn.sm} ${btn.plain}`}>
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={`${btn.btn} ${btn.sm} ${styles.danger}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
