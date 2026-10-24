import { describe, expect, it } from "vitest";
import { placeName, placeNameWithStreet } from "./place-name";

describe("placeName", () => {
  it("names address-named buildings after their neighborhood, and keeps real names", () => {
    expect(placeName({ name: "8 W 126th St", neighborhood: "Harlem" })).toBe("WeWork Harlem");
    expect(placeName({ name: "Dumbo Heights", neighborhood: "Dumbo" })).toBe("Dumbo Heights");
    expect(placeName({ name: "One Seaport Square", neighborhood: "Seaport" })).toBe(
      "One Seaport Square",
    );
  });

  it("adds the street where several buildings share a neighborhood", () => {
    expect(placeNameWithStreet({ name: "85 Broad St", neighborhood: "Financial District" })).toBe(
      "WeWork Financial District · 85 Broad St",
    );
    expect(placeNameWithStreet({ name: "Coda", neighborhood: "Tech Square" })).toBe("Coda");
  });
});
