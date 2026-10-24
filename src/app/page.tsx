import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { listPeopleForDirectory } from "@/features/people/people-queries";
import { computeTelemetry } from "@/features/people/telemetry";

export default async function DirectoryPage() {
  // listPeopleForDirectory() runs requireClassAccess() before touching any data.
  const people = await listPeopleForDirectory();
  const sorted = [...people].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
  // Computed here so the server and the browser agree on "today".
  const today = new Date();
  return <DashboardShell people={sorted} telemetry={computeTelemetry(sorted, today)} currentMonth={today.getUTCMonth()} />;
}
