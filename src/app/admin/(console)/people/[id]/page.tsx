import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeletePersonDialog } from "@/components/admin/delete-person-dialog";
import { PersonForm } from "@/components/admin/person-form";
import { getPersonForAdmin } from "@/features/people/people-admin";

export const metadata: Metadata = { title: "CLASSNET // Edit person" };

export default async function EditPersonPage({ params, searchParams }: PageProps<"/admin/people/[id]">) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const person = await getPersonForAdmin(id);
  if (!person) notFound();

  return (
    <>
      <div className="admin-title-row">
        <h1 className="grad-text">{person.full_name}</h1>
        <DeletePersonDialog personId={person.id} fullName={person.full_name} />
      </div>
      {saved === "ok" ? (
        <p className="form-success" role="status">
          Saved.
        </p>
      ) : null}
      {saved === "nopin" ? (
        <p className="form-error" role="status">
          Saved without a pin: the address could not be located. Set the pin on the map and save again.
        </p>
      ) : null}
      {/* Remount after each save so the form starts from the stored values. */}
      <PersonForm key={person.updated_at} person={person} />
    </>
  );
}
