import { describe, expect, it } from "vitest";
import { barcodeBars, initials, machineReadableZone, subjectCode } from "./dossier-codes";

const PERSON = {
  id: "11111111-1111-4111-8111-000000000001",
  full_name: "Nguyễn Văn Ảo",
  date_of_birth: "1998-03-14",
};

describe("dossier codes", () => {
  it("takes the family and given-name initials, keeping diacritics", () => {
    expect(initials("Nguyễn Văn Ảo")).toBe("NẢ");
    expect(initials("  đặng  ")).toBe("Đ");
    expect(initials("")).toBe("?");
  });

  it("uses the tail of the record id as the subject code", () => {
    expect(subjectCode(PERSON.id)).toBe("000001");
    expect(subjectCode("3f2a9c1e-0000-4000-8000-00000abcdef9")).toBe("BCDEF9");
  });

  it("writes two 30-character machine-readable lines without diacritics", () => {
    const [first, second] = machineReadableZone(PERSON);
    expect(first).toBe("CN<VNM<NGUYEN<<VAN<AO<<<<<<<<<");
    expect(second).toBe("980314<000001<<CLASSNET<<<<<<<");
    expect(machineReadableZone({ ...PERSON, full_name: "Đặng Quốc Chưa Định Vị" })[0]).toBe(
      "CN<VNM<DANG<<QUOC<CHUA<DINH<VI",
    );
  });

  it("truncates long names to the line length", () => {
    const [first] = machineReadableZone({ ...PERSON, full_name: "Tôn Nữ Thị Hoàng Phương Uyên Nhi" });
    expect(first).toHaveLength(30);
  });

  it("draws the same barcode for the same text", () => {
    const bars = barcodeBars("AB");
    expect(bars).toHaveLength(6);
    expect(bars).toEqual(barcodeBars("AB"));
    expect(bars.every((bar) => bar.width >= 1 && bar.width <= 3)).toBe(true);
    expect(barcodeBars("AC")).not.toEqual(bars);
  });
});
