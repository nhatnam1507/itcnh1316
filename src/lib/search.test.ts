import { describe, expect, it } from "vitest";
import { matchesSearch, searchKey } from "./search";

describe("search", () => {
  it("drops diacritics, đ and extra spaces", () => {
    expect(searchKey("  Đặng   Quốc  Chưa ")).toBe("dang quoc chua");
    expect(searchKey("Nguyễn Văn Ảo")).toBe("nguyen van ao");
  });

  it("matches every word anywhere in the fields, with or without accents", () => {
    expect(matchesSearch("nguyen ao", "Nguyễn Văn Ảo")).toBe(true);
    expect(matchesSearch("Ảo", "Nguyễn Văn Ảo")).toBe(true);
    expect(matchesSearch("hai phong", "Đặng Quốc Chưa", "Một địa chỉ, Hải Phòng")).toBe(true);
    expect(matchesSearch("ao hue", "Nguyễn Văn Ảo", "Hà Nội")).toBe(false);
  });

  it("treats a blank query as matching everything", () => {
    expect(matchesSearch("   ", "anyone")).toBe(true);
  });
});
