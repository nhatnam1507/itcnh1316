import { describe, expect, it } from "vitest";
import type { DirectoryPerson } from "./people-queries";
import { computeTelemetry, daysUntilBirthday } from "./telemetry";

function person(id: string, dateOfBirth: string, latitude: number | null, longitude: number | null): DirectoryPerson {
  return { id, full_name: `Person ${id}`, date_of_birth: dateOfBirth, mobile_phone: "+84912000000", address: "", latitude, longitude };
}

const today = new Date(Date.UTC(2026, 9, 20, 15, 0));

describe("daysUntilBirthday", () => {
  it("counts today as zero and wraps to next year once passed", () => {
    expect(daysUntilBirthday("1998-10-20", today)).toBe(0);
    expect(daysUntilBirthday("1998-10-21", today)).toBe(1);
    expect(daysUntilBirthday("1998-10-19", today)).toBe(364);
  });

  it("treats 29 February as 1 March in a non-leap year", () => {
    expect(daysUntilBirthday("2000-02-29", new Date(Date.UTC(2027, 1, 28)))).toBe(1);
  });
});

describe("computeTelemetry", () => {
  const people = [
    person("north", "1998-03-14", 21, 106),
    person("south", "1997-11-23", 11, 106),
    person("east", "1998-03-02", 16, 109),
    person("unpinned", "1998-10-25", null, null),
  ];
  const telemetry = computeTelemetry(people, today);

  it("counts people, pins and births per month", () => {
    expect(telemetry.total).toBe(4);
    expect(telemetry.fixed).toBe(3);
    expect(telemetry.birthsByMonth[2]).toBe(2);
    expect(telemetry.birthsByMonth[9]).toBe(1);
    expect(telemetry.birthsByMonth.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("finds the next birthday, including people without a pin", () => {
    expect(telemetry.nextBirthday).toEqual({ id: "unpinned", name: "Person unpinned", days: 5 });
  });

  it("places only pinned people on the radar, by bearing from the centroid", () => {
    const byId = Object.fromEntries(telemetry.blips.map((blip) => [blip.id, blip]));
    expect(Object.keys(byId).sort()).toEqual(["east", "north", "south"]);
    expect(Math.min(byId.north.angle, 360 - byId.north.angle)).toBeLessThan(20);
    expect(byId.east.angle).toBeGreaterThan(45);
    expect(byId.east.angle).toBeLessThan(135);
    expect(byId.south.angle).toBeGreaterThan(135);
    expect(byId.south.angle).toBeLessThan(225);
    for (const blip of telemetry.blips) {
      expect(blip.distance).toBeGreaterThanOrEqual(0.15);
      expect(blip.distance).toBeLessThanOrEqual(0.95 + 1e-9);
    }
  });

  it("handles an empty class", () => {
    expect(computeTelemetry([], today)).toEqual({ total: 0, fixed: 0, birthsByMonth: Array(12).fill(0), nextBirthday: null, blips: [] });
  });
});
