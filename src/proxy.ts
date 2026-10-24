import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { classSessionSigningKey } from "@/lib/passcode/class-session-key";
import { CLASS_SESSION_COOKIE, verifySessionToken } from "@/lib/passcode/session-token";
import { hardenCookieOptions, isSupabaseAuthCookie } from "@/lib/supabase/hardened-cookie-options";

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" };

function isPageNavigation(request: NextRequest): boolean {
  return (request.method === "GET" || request.method === "HEAD") && !request.headers.has("next-action");
}

/** Keeps the admin's Supabase tokens fresh so they don't expire mid-session. */
async function refreshAdminSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!request.cookies.getAll().some(({ name }) => isSupabaseAuthCookie(name))) return response;

  const env = getServerEnv();
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: hardenCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenCookieOptions(options));
        }
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/unlock") return NextResponse.next();

  const token = request.cookies.get(CLASS_SESSION_COOKIE)?.value;
  const hasAccess =
    token !== undefined && (await verifySessionToken(classSessionSigningKey(getServerEnv()), token, Date.now()));

  if (!hasAccess) {
    if (!isPageNavigation(request)) {
      return new NextResponse("Unauthorized", { status: 401, headers: NOINDEX });
    }
    const response = NextResponse.redirect(new URL("/unlock", request.url));
    response.headers.set("X-Robots-Tag", NOINDEX["X-Robots-Tag"]);
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/admin")) return refreshAdminSession(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
