import Link from "next/link";
import { ClassnetEmblem } from "@/components/brand/classnet-emblem";
import { countPendingRequests } from "@/features/change-requests/change-request-service";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "./admin-nav";

export default async function AdminConsoleLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin();
  const pending = await countPendingRequests();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link href="/admin" className="admin-brand">
          <ClassnetEmblem className="admin-emblem" />
          <span className="grad-text">CLASSNET // ADMIN</span>
        </Link>
        <AdminNav pending={pending} />
        <form action="/admin/logout" method="post" className="admin-logout">
          <span className="hud-label">{user.email}</span>
          <button type="submit" className="btn">
            Log out
          </button>
        </form>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
