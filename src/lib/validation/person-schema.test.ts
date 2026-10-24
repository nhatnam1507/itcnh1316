import { describe, expect, it } from "vitest";
import {
  changeRequestSchema,
  fieldErrorsOf,
  normalizeVietnamMobile,
  personCreateSchema,
} from "./person-schema";

const PERSON_ID = "11111111-1111-4111-8111-000000000001";

describe("normalizeVietnamMobile", () => {
  it.each([
    ["0912 345 678", "+84912345678"],
    ["+84912345678", "+84912345678"],
    ["091.234.5678", "+84912345678"],
    ["0387-654-321", "+84387654321"],
    ["+84 705 111 222", "+84705111222"],
    ["0563000005", "+84563000005"],
    ["0868000006", "+84868000006"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeVietnamMobile(input)).toBe(expected);
  });

  it.each([
    ["+1 415 555 0100"],
    ["02123456789"], // landline
    ["0212345678"], // landline-style prefix
    ["091234567"], // too short
    ["09123456789"], // too long
    ["+8491234567"], // too short
    ["84912345678"], // missing + or 0
    ["0412345678"], // not a mobile prefix
    ["abc"],
    [""],
  ])("rejects %s", (input) => {
    expect(normalizeVietnamMobile(input)).toBeNull();
  });
});

describe("personCreateSchema", () => {
  const valid = {
    full_name: "  Nguyễn Văn Ảo ",
    date_of_birth: "1998-03-14",
    mobile_phone: "0912 345 678",
    address: " Hồ Hoàn Kiếm, Hà Nội ",
    latitude: "",
    longitude: "",
    location_source: "",
  };

  it("trims strings, normalizes the phone and treats an empty pin as absent", () => {
    const result = personCreateSchema.parse(valid);
    expect(result).toEqual({
      full_name: "Nguyễn Văn Ảo",
      date_of_birth: "1998-03-14",
      mobile_phone: "+84912345678",
      address: "Hồ Hoàn Kiếm, Hà Nội",
      latitude: undefined,
      longitude: undefined,
      location_source: undefined,
    });
  });

  it("stores Vietnamese text in NFC form", () => {
    const decomposed = "Nguyễn Văn Ảo".normalize("NFD");
    const result = personCreateSchema.parse({ ...valid, full_name: decomposed, address: `${decomposed} street` });
    expect(result.full_name).toBe("Nguyễn Văn Ảo".normalize("NFC"));
    expect(result.address).toBe(`${"Nguyễn Văn Ảo".normalize("NFC")} street`);
  });

  it("accepts a manual pin", () => {
    const result = personCreateSchema.parse({ ...valid, latitude: "21.03", longitude: "105.85", location_source: "manual" });
    expect(result).toMatchObject({ latitude: 21.03, longitude: 105.85, location_source: "manual" });
  });

  it("rejects a future date of birth", () => {
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = personCreateSchema.safeParse({ ...valid, date_of_birth: tomorrow });
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!).date_of_birth).toBeDefined();
  });

  it("rejects impossible dates", () => {
    expect(personCreateSchema.safeParse({ ...valid, date_of_birth: "1998-02-30" }).success).toBe(false);
  });

  it("rejects a half-set pin and out-of-range coordinates", () => {
    expect(personCreateSchema.safeParse({ ...valid, latitude: "21", longitude: "" }).success).toBe(false);
    expect(personCreateSchema.safeParse({ ...valid, latitude: "91", longitude: "105" }).success).toBe(false);
  });

  it("reports a field error for a non-Vietnamese phone", () => {
    const result = personCreateSchema.safeParse({ ...valid, mobile_phone: "+1 415 555 0100" });
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!).mobile_phone?.[0]).toMatch(/Vietnamese mobile/);
  });
});

describe("changeRequestSchema", () => {
  it("rejects an empty change request", () => {
    const result = changeRequestSchema.safeParse({
      person_id: PERSON_ID,
      proposed_full_name: "",
      proposed_date_of_birth: " ",
      proposed_mobile_phone: "",
      proposed_address: "",
      requester_note: "just saying hi",
    });
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!).form?.[0]).toMatch(/at least one/);
  });

  it("accepts a partial change and normalizes the phone", () => {
    const result = changeRequestSchema.parse({
      person_id: PERSON_ID,
      proposed_mobile_phone: "0983 000 004",
      requester_note: "",
    });
    expect(result).toEqual({
      person_id: PERSON_ID,
      proposed_full_name: undefined,
      proposed_date_of_birth: undefined,
      proposed_mobile_phone: "+84983000004",
      proposed_address: undefined,
      requester_note: undefined,
    });
  });

  it("rejects an invalid person id and an overlong note", () => {
    expect(changeRequestSchema.safeParse({ person_id: "1", proposed_full_name: "A" }).success).toBe(false);
    expect(
      changeRequestSchema.safeParse({ person_id: PERSON_ID, proposed_full_name: "A", requester_note: "x".repeat(501) })
        .success,
    ).toBe(false);
  });
});
