// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { focusSection } from "./focus";

afterEach(() => document.body.replaceChildren());

describe("focusSection", () => {
  it("focuses the named section's heading, making it focusable", () => {
    document.body.innerHTML = `
      <section aria-label="Scorecard"><h2>Scorecard</h2></section>
      <section aria-label="Reviews"><h2>Reviews</h2><button>Delete</button></section>`;
    focusSection("Reviews");
    const heading = document.querySelector('section[aria-label="Reviews"] h2')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });

  it("does nothing when the section isn't on the page", () => {
    document.body.innerHTML = `<button id="b">Delete</button>`;
    const button = document.getElementById("b")!;
    button.focus();
    focusSection("Signed in on");
    expect(document.activeElement).toBe(button);
  });
});
