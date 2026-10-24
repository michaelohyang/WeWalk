/**
 * Moves focus to a page section's heading (a <Section title=…>). For after an action removes
 * the button that had focus (a deleted review, a signed-out phone), so keyboard and screen
 * reader users keep their place instead of landing on <body>.
 */
export function focusSection(title: string) {
  const heading = document.querySelector<HTMLElement>(
    `section[aria-label="${CSS.escape(title)}"] h2`,
  );
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}
