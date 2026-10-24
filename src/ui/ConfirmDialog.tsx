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
  children,
}: {
  /** The button that opens the dialog. */
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Closes the dialog unless it calls `event.preventDefault()` (e.g. to show an error). */
  onConfirm: (event: React.MouseEvent) => void;
  /** Extra content between the description and the buttons, such as a password field. */
  children?: React.ReactNode;
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
          {children && <div className={styles.extra}>{children}</div>}
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
