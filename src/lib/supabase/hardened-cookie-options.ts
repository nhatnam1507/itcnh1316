import type { CookieOptions } from "@supabase/ssr";

/**
 * No browser Supabase client exists, so the admin's auth cookies never need to be
 * readable from JavaScript. Force httpOnly whatever @supabase/ssr asks for.
 */
export function hardenCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

/** @supabase/ssr stores the admin session in cookies named `sb-<ref>-auth-token[.n]`. */
export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}
