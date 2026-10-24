"use client";

import { Icon } from "./Icon";
import { apply } from "./theme";
import styles from "./ThemeSwitch.module.css";

/** The moon button in the Explore header: flips between light and dark. */
export function ThemeToggle() {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label="Toggle dark mode"
      onClick={() => {
        const root = document.documentElement;
        const dark = root.dataset.theme
          ? root.dataset.theme === "dark"
          : matchMedia("(prefers-color-scheme: dark)").matches;
        apply(dark ? "light" : "dark");
      }}
    >
      <Icon name="moon" size={20} />
    </button>
  );
}
