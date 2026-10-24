/*
 * The theme choice, shared by the full switch (Crew), the moon button (Explore) and the root
 * layout's boot script. A plain module, not a client component, so the root layout can import
 * it without shipping the theme switch to every page.
 */

export type Theme = "system" | "light" | "dark";
const THEME_KEY = "wewalk:theme";

/** Runs before first paint (inlined in <head>) so a chosen theme never flashes. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function apply(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // private mode: the choice just won't stick
  }
}
