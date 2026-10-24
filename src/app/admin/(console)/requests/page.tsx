import type { Metadata } from "next";
import { ChangeRequestCard } from "@/components/admin/change-request-card";
import { listPendingRequests } from "@/features/change-requests/change-request-service";

export const metadata: Metadata = { title: "CLASSNET // Requests" };

export default async function RequestsPage() {
  const requests = await listPendingRequests();

  return (
    <>
      <h1 className="grad-text">Pending change requests</h1>
      <p className="hud-label">
        Anyone with the class passcode can submit a request. Check that each change is genuine before approving.
      </p>
      {requests.length === 0 ? (
        <p className="form-success" role="status">
          Queue clear. No pending requests.
        </p>
      ) : (
        <div className="request-list">
          {requests.map((request) => (
            <ChangeRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </>
  );
}
