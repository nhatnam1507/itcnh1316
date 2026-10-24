"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminPerson } from "@/features/people/people-admin";
import { formatDate, formatPhone } from "@/lib/format";
import { matchesSearch } from "@/lib/search";

/** People table with an instant filter. On phones each row is laid out as a card (see CSS). */
export function PeopleTable({ people }: { people: AdminPerson[] }) {
  const [query, setQuery] = useState("");
  const rows = people.filter((person) =>
    matchesSearch(query, person.full_name, person.address, person.mobile_phone, formatPhone(person.mobile_phone)),
  );

  return (
    <>
      <div className="table-filter">
        <input
          type="search"
          className="input"
          aria-label="Filter people by name, phone or address"
          placeholder="Filter by name, phone or address"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="hud-label" role="status">
          {query.trim() ? `${rows.length} of ${people.length}` : null}
        </span>
      </div>
      <div className="table-wrap panel-frame">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Born</th>
              <th scope="col">Mobile</th>
              <th scope="col">Address</th>
              <th scope="col">Pin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => (
              <tr key={person.id}>
                <td data-label="Name">
                  <Link href={`/admin/people/${person.id}`}>{person.full_name}</Link>
                </td>
                <td data-label="Born">{formatDate(person.date_of_birth)}</td>
                <td data-label="Mobile" className="nowrap">
                  {formatPhone(person.mobile_phone)}
                </td>
                <td data-label="Address">{person.address}</td>
                <td data-label="Pin">
                  {person.latitude === null ? (
                    <span className="badge badge-warn">no pin</span>
                  ) : (
                    <span className="badge badge-ok">{person.location_source}</span>
                  )}
                </td>
              </tr>
            ))}
            {people.length === 0 ? (
              <tr>
                <td colSpan={5}>No people yet. Add the first classmate with “New person”.</td>
              </tr>
            ) : null}
            {people.length > 0 && rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  No one matches “{query.trim()}”.{" "}
                  <button type="button" className="link-button" onClick={() => setQuery("")}>
                    Clear the filter
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
