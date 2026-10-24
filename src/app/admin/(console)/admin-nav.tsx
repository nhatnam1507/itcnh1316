"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Which section a console path belongs to; editing a person counts as People. */
function sectionOf(pathname: string): string {
  if (pathname === "/admin/people/new") return "new";
  if (pathname.startsWith("/admin/requests")) return "requests";
  return "people";
}

export function AdminNav({ pending }: { pending: number }) {
  const section = sectionOf(usePathname());
  const current = (name: string) => (section === name ? "page" : undefined);

  return (
    <nav aria-label="Admin" className="admin-nav">
      <Link href="/admin" aria-current={current("people")}>
        People
      </Link>
      <Link href="/admin/people/new" aria-current={current("new")}>
        New person
      </Link>
      <Link href="/admin/requests" aria-current={current("requests")}>
        Requests{" "}
        <span className={pending > 0 ? "badge badge-alert" : "badge"} aria-label={`${pending} pending`}>
          {pending}
        </span>
      </Link>
      <Link href="/">Directory</Link>
    </nav>
  );
}
