import type { Metadata } from "next";
import Link from "next/link";
import { countPendingRequests } from "@/features/change-requests/change-request-service";
import { listPeopleForAdmin } from "@/features/people/people-admin";
import { PeopleTable } from "./people-table";

export const metadata: Metadata = { title: "CLASSNET // Admin" };

export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  const [people, pending, params] = await Promise.all([listPeopleForAdmin(), countPendingRequests(), searchParams]);
  const withoutPin = people.filter((person) => person.latitude === null).length;

  return (
    <>
      <div className="admin-title-row">
        <h1 className="grad-text">People</h1>
        <Link href="/admin/people/new" className="btn btn-primary">
          New person
        </Link>
      </div>
      {params.deleted ? (
        <p className="form-success" role="status">
          Person deleted.
        </p>
      ) : null}
      <p className="admin-stats">
        <span>{people.length} people</span>
        <span className={withoutPin ? "badge badge-warn" : "badge badge-ok"}>{withoutPin} without pin</span>
        <Link href="/admin/requests">
          {pending} pending request{pending === 1 ? "" : "s"}
        </Link>
      </p>
      <PeopleTable people={people} />
    </>
  );
}
