import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassnetEmblem } from "@/components/brand/classnet-emblem";
import { getAdminSession } from "@/lib/auth/require-admin";
import { requireClassAccess } from "@/lib/passcode/class-session";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "CLASSNET // Admin login" };

export default async function AdminLoginPage() {
  await requireClassAccess();
  if (await getAdminSession()) redirect("/admin");

  return (
    <main className="unlock-screen">
      <section className="unlock-card panel-frame" aria-labelledby="admin-login-title">
        <div className="card-brand">
          <ClassnetEmblem className="card-emblem" />
          <p className="hud-label">Operator access</p>
        </div>
        <h1 id="admin-login-title" className="grad-text">
          ADMIN LOGIN
        </h1>
        <AdminLoginForm />
        <Link href="/" className="hud-label">
          ← Back to directory
        </Link>
      </section>
    </main>
  );
}
