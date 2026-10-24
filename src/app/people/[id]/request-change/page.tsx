import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeRequestForm } from "@/components/change-requests/change-request-form";
import { getPerson } from "@/features/people/people-queries";
import { formatDate, formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "CLASSNET // Request change" };

export default async function RequestChangePage({ params }: PageProps<"/people/[id]/request-change">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();

  return (
    <main className="admin-main">
      <Link href="/" className="hud-label">
        ← Back to the console
      </Link>
      <h1 className="grad-text">Request a change</h1>
      <section className="panel-frame request-current" aria-labelledby="current-title">
        <h2 id="current-title" className="hud-label">
          Current record
        </h2>
        <dl className="dossier-fields">
          <div>
            <dt className="hud-label">Name</dt>
            <dd>{person.full_name}</dd>
          </div>
          <div>
            <dt className="hud-label">Born</dt>
            <dd>{formatDate(person.date_of_birth)}</dd>
          </div>
          <div>
            <dt className="hud-label">Mobile</dt>
            <dd>{formatPhone(person.mobile_phone)}</dd>
          </div>
          <div>
            <dt className="hud-label">Address</dt>
            <dd>{person.address}</dd>
          </div>
        </dl>
      </section>
      <ChangeRequestForm person={person} />
    </main>
  );
}
