import "server-only";
import { z } from "zod";
import { requireClassAccess } from "@/lib/passcode/class-session";
import { getSecretClient } from "@/lib/supabase/secret-client";

/** Only the fields the directory UI shows. */
const DIRECTORY_FIELDS = "id, full_name, date_of_birth, mobile_phone, address, latitude, longitude";

export type DirectoryPerson = {
  id: string;
  full_name: string;
  date_of_birth: string;
  mobile_phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export async function listPeopleForDirectory(): Promise<DirectoryPerson[]> {
  await requireClassAccess();
  const { data, error } = await getSecretClient()
    .from("people")
    .select(DIRECTORY_FIELDS)
    .order("full_name", { ascending: true });
  if (error) throw new Error(`Could not load the directory: ${error.code}`);
  return data;
}

export async function getPerson(id: string): Promise<DirectoryPerson | null> {
  await requireClassAccess();
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await getSecretClient().from("people").select(DIRECTORY_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the person: ${error.code}`);
  return data;
}
