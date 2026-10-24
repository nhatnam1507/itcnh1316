"use client";

import dynamic from "next/dynamic";
import { useActionState, useEffect, useState, useTransition } from "react";
import { locateAddressAction } from "@/app/admin/(console)/people/actions";
import { approveRequestAction, rejectRequestAction } from "@/app/admin/(console)/requests/actions";
import type { PinValue } from "@/components/map/pin-picker";
import type { PendingChangeRequest } from "@/features/change-requests/change-request-service";
import type { ActionResult } from "@/lib/action-result";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";

const PinPicker = dynamic(() => import("@/components/map/pin-picker"), {
  ssr: false,
  loading: () => <div className="pin-picker-map pin-picker-loading">Loading map…</div>,
});

type Row = { label: string; current: string; proposed: string | null };

function rowsFor(request: PendingChangeRequest): Row[] {
  const { person } = request;
  return [
    { label: "Name", current: person.full_name, proposed: request.proposed_full_name },
    {
      label: "Born",
      current: formatDate(person.date_of_birth),
      proposed: request.proposed_date_of_birth && formatDate(request.proposed_date_of_birth),
    },
    {
      label: "Mobile",
      current: formatPhone(person.mobile_phone),
      proposed: request.proposed_mobile_phone && formatPhone(request.proposed_mobile_phone),
    },
    { label: "Address", current: person.address, proposed: request.proposed_address },
  ];
}

export function ChangeRequestCard({ request }: { request: PendingChangeRequest }) {
  const [approveState, approve, approving] = useActionState<ActionResult | null, FormData>(approveRequestAction, null);
  const [rejectState, reject, rejecting] = useActionState<ActionResult | null, FormData>(rejectRequestAction, null);
  const [pin, setPin] = useState<PinValue | null>(null);
  const [source, setSource] = useState<"geocoded" | "manual" | null>(null);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const [locating, startLocate] = useTransition();
  const addressChanged = request.proposed_address !== null;

  // Preview the proposed address once, so the admin can check or correct the pin before approving.
  useEffect(() => {
    if (!request.proposed_address) return;
    const address = request.proposed_address;
    startLocate(async () => {
      const found = await locateAddressAction(address);
      if (found) {
        setPin(found);
        setSource("geocoded");
        setLocateMessage("Proposed address located. Adjust the pin if needed.");
      } else {
        setLocateMessage("Proposed address not found. Click the map to set the pin, or approve without one.");
      }
    });
  }, [request.proposed_address]);

  const latest = [approveState, rejectState].find((state) => state && !state.ok);
  const busy = approving || rejecting;

  return (
    <article className="request-card panel-frame" aria-labelledby={`request-${request.id}`}>
      <header className="request-card-header">
        <h2 id={`request-${request.id}`}>{request.person.full_name}</h2>
        <span className="hud-label">Submitted {formatDateTime(request.submitted_at)}</span>
      </header>

      <table className="diff-table">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Current</th>
            <th scope="col">Proposed</th>
          </tr>
        </thead>
        <tbody>
          {rowsFor(request).map((row) => {
            const changed = row.proposed !== null && row.proposed !== row.current;
            return (
              <tr key={row.label} className={changed ? "diff-changed" : undefined}>
                <th scope="row">{row.label}</th>
                <td>{row.current}</td>
                <td>{row.proposed ?? <span className="hud-label">unchanged</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {request.requester_note ? (
        <blockquote className="requester-note">
          <span className="hud-label">Requester note</span>
          <p>{request.requester_note}</p>
        </blockquote>
      ) : null}

      <form className="review-form">
        <input type="hidden" name="request_id" value={request.id} />
        {addressChanged ? (
          <fieldset className="person-form-pin">
            <legend className="hud-label">New pin</legend>
            <p className="hud-label" role="status">
              {locating ? "Locating proposed address…" : locateMessage}
            </p>
            <input type="hidden" name="latitude" value={pin?.lat ?? ""} />
            <input type="hidden" name="longitude" value={pin?.lng ?? ""} />
            <input type="hidden" name="location_source" value={pin ? (source ?? "manual") : ""} />
            <PinPicker
              value={pin}
              onPick={(next) => {
                setPin(next);
                setSource("manual");
              }}
              label={`Pin for the proposed address of ${request.person.full_name}`}
            />
          </fieldset>
        ) : null}
        <div className="field">
          <label htmlFor={`note-${request.id}`}>Reviewer note (optional)</label>
          <input id={`note-${request.id}`} name="reviewer_note" maxLength={500} />
        </div>
        {latest && !latest.ok ? (
          <p className="form-error" role="alert">
            {latest.error ?? "Check the pin and note and try again."}
          </p>
        ) : null}
        <div className="form-actions">
          <button type="submit" formAction={reject} className="btn btn-danger" disabled={busy}>
            {rejecting ? "Rejecting…" : "Reject"}
          </button>
          <button type="submit" formAction={approve} className="btn btn-success" disabled={busy || locating}>
            {approving ? "Approving…" : "Approve"}
          </button>
        </div>
      </form>
    </article>
  );
}
