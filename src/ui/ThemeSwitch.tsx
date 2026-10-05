"use client";

import { useEffect, useState } from "react";
import { Segmented } from "./Chips";

type Theme = "system" | "light" | "dark";
export const THEME_KEY = "wewalk:theme";

/** Runs before first paint (inlined in <head>) so a chosen theme never flashes. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function apply(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // private mode: the choice just won't stick
  }
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    // Reading the boot script's result once on mount; nothing to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "light" || t === "dark") setTheme(t);
  }, []);
  return (
    <Segmented
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
