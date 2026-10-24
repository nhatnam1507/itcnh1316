import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/session-client";

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
}
