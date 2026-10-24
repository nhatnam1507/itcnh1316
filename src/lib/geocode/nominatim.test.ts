import { describe, expect, it } from "vitest";
import hoanKiem from "./fixtures/nominatim-hoan-kiem.json";
import { parseNominatimResponse } from "./nominatim";

describe("parseNominatimResponse", () => {
  it("reads the first jsonv2 result's coordinates", () => {
    expect(parseNominatimResponse(hoanKiem)).toEqual({ lat: 21.0287797, lng: 105.85238 });
  });

  it("returns null for an empty result", () => {
    expect(parseNominatimResponse([])).toBeNull();
  });

  it("returns null for unexpected shapes instead of throwing", () => {
    expect(parseNominatimResponse({ error: "rate limited" })).toBeNull();
    expect(parseNominatimResponse(null)).toBeNull();
    expect(parseNominatimResponse([{ lat: "abc", lon: "1" }])).toBeNull();
    expect(parseNominatimResponse([{ lat: "95", lon: "1" }])).toBeNull();
  });
});
