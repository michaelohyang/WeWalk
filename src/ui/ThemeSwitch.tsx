"use client";

import { useEffect, useState } from "react";
import { SegmentedButtons } from "./SegmentedButtons";
import { apply, type Theme } from "./theme";

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    // Reading the boot script's result once on mount; nothing to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "light" || t === "dark") setTheme(t);
  }, []);
  return (
    <SegmentedButtons
      label="Theme"
      value={theme}
      options={[
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
      onChange={(t) => {
        setTheme(t);
        apply(t);
      }}
    />
  );
}
