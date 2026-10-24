import { readFileSync } from "node:fs";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

// Production Auth and API settings live in infra/supabase-settings.json (applied by Terraform);
// the local stack reads supabase/config.toml. This test keeps the two in step.
type LocalConfig = {
  api: { schemas: string[]; extra_search_path: string[]; max_rows: number };
  auth: {
    enable_signup: boolean;
    enable_anonymous_sign_ins: boolean;
    enable_manual_linking: boolean;
    minimum_password_length: number;
    jwt_expiry: number;
    enable_refresh_token_rotation: boolean;
    refresh_token_reuse_interval: number;
    rate_limit: { token_refresh: number; token_verifications: number };
    email: { enable_signup: boolean; enable_confirmations: boolean; double_confirm_changes: boolean };
    sms: { enable_signup: boolean };
  };
};

const config = parse(readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8")) as unknown as LocalConfig;
const settings: { auth: Record<string, unknown>; api: Record<string, unknown> } = JSON.parse(
  readFileSync(new URL("../infra/supabase-settings.json", import.meta.url), "utf8"),
);

// Management API field → value derived from config.toml.
const expectedAuth: Record<string, unknown> = {
  disable_signup: !config.auth.enable_signup,
  external_email_enabled: config.auth.email.enable_signup,
  mailer_autoconfirm: !config.auth.email.enable_confirmations,
  mailer_secure_email_change_enabled: config.auth.email.double_confirm_changes,
  external_anonymous_users_enabled: config.auth.enable_anonymous_sign_ins,
  external_phone_enabled: config.auth.sms.enable_signup,
  security_manual_linking_enabled: config.auth.enable_manual_linking,
  password_min_length: config.auth.minimum_password_length,
  jwt_exp: config.auth.jwt_expiry,
  refresh_token_rotation_enabled: config.auth.enable_refresh_token_rotation,
  security_refresh_token_reuse_interval: config.auth.refresh_token_reuse_interval,
  rate_limit_token_refresh: config.auth.rate_limit.token_refresh,
  rate_limit_verify: config.auth.rate_limit.token_verifications,
};

const expectedApi: Record<string, unknown> = {
  db_schema: config.api.schemas.join(","),
  db_extra_search_path: config.api.extra_search_path.join(","),
  max_rows: config.api.max_rows,
};

describe("infra/supabase-settings.json mirrors supabase/config.toml", () => {
  it("has only the auth and api sections", () => {
    expect(Object.keys(settings).sort()).toEqual(["api", "auth"]);
  });

  it.each(Object.entries(expectedAuth))("auth.%s matches config.toml", (field, value) => {
    expect(value).toBeDefined();
    expect(settings.auth[field]).toBe(value);
  });

  it.each(Object.entries(expectedApi))("api.%s matches config.toml", (field, value) => {
    expect(value).toBeDefined();
    expect(settings.api[field]).toBe(value);
  });

  it("declares no field outside the mapping", () => {
    // A new field needs a config.toml counterpart above; production-only fields belong in infra/supabase.tf.
    expect(Object.keys(settings.auth).sort()).toEqual(Object.keys(expectedAuth).sort());
    expect(Object.keys(settings.api).sort()).toEqual(Object.keys(expectedApi).sort());
  });
});
