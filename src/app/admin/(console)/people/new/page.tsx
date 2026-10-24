import type { Metadata } from "next";
import { PersonForm } from "@/components/admin/person-form";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { title: "CLASSNET // New person" };

export default async function NewPersonPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="grad-text">New person</h1>
      <PersonForm />
    </>
  );
}
