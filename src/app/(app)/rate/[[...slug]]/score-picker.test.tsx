// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES } from "@/domain/categories";
import type { Scores } from "./rate-form";
import { ScorePicker } from "./score-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let latest: Scores = {};

function Harness() {
  const [scores, setScores] = useState<Scores>({});
  return (
    <ScorePicker
      ref={null}
      scores={scores}
      onChange={(next) => {
        latest = next;
        setScores(next);
      }}
    />
  );
}

const row = (category: string) =>
  container.querySelector<HTMLElement>(`[role=radiogroup][aria-labelledby="cat-${category}"]`)!;
const radio = (category: string, n: number) =>
  row(category).querySelector<HTMLButtonElement>(`[role=radio][aria-label="${n} out of 5"]`)!;
const tap = (el: HTMLElement) => act(() => el.click());

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ScorePicker", () => {
  it("is one labelled radio group of five per category", () => {
    const groups = container.querySelectorAll("[role=radiogroup]");
    expect(groups).toHaveLength(CATEGORIES.length);
    for (const c of CATEGORIES) {
      expect(row(c.key).querySelectorAll("[role=radio]"), c.key).toHaveLength(5);
    }
  });

  it("picks a score on tap and clears it on a second tap", async () => {
    await tap(radio("coffee", 4));
    expect(latest.coffee).toBe(4);
    expect(radio("coffee", 4).getAttribute("aria-checked")).toBe("true");
    expect(radio("coffee", 3).getAttribute("aria-checked")).toBe("false");

    await tap(radio("coffee", 2));
    expect(latest.coffee).toBe(2);

    await tap(radio("coffee", 2));
    expect(latest.coffee).toBeUndefined();
    expect(radio("coffee", 2).getAttribute("aria-checked")).toBe("false");
  });

  it("keeps categories independent", async () => {
    await tap(radio("coffee", 5));
    await tap(radio("wifi", 1));
    expect(latest).toEqual({ coffee: 5, wifi: 1 });
  });

  it("is one Tab stop per row, landing on the picked score", async () => {
    await tap(radio("wifi", 3));
    const tabbable = [
      row("wifi"),
      ...row("wifi").querySelectorAll<HTMLElement>("[role=radio]"),
    ].filter((el) => el.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    // Tabbing into the row focuses the picked score, as the old hand-written radios did.
    await act(() => tabbable[0]!.focus());
    expect(document.activeElement).toBe(radio("wifi", 3));
  });
});
