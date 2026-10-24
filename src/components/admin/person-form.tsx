"use client";

import dynamic from "next/dynamic";
import { useActionState, useRef, useState, useTransition } from "react";
import { locateAddressAction, savePersonAction } from "@/app/admin/(console)/people/actions";
import { DateInput } from "@/components/forms/date-input";
import type { PinValue } from "@/components/map/pin-picker";
import type { AdminPerson } from "@/features/people/people-admin";
import type { ActionResult } from "@/lib/action-result";
import { describedBy, FieldError } from "./field-error";

const PinPicker = dynamic(() => import("@/components/map/pin-picker"), {
  ssr: false,
  loading: () => <div className="pin-picker-map pin-picker-loading">Loading map…</div>,
});

type LocationSource = "geocoded" | "manual";

export function PersonForm({ person }: { person?: AdminPerson }) {
  const [state, formAction, saving] = useActionState<ActionResult | null, FormData>(savePersonAction, null);
  const [pin, setPin] = useState<PinValue | null>(
    person?.latitude != null && person.longitude != null ? { lat: person.latitude, lng: person.longitude } : null,
  );
  const [source, setSource] = useState<LocationSource | null>((person?.location_source as LocationSource) ?? null);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const [locating, startLocate] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: keyof AdminPerson) => submitted?.[name] ?? (person?.[name] as string | undefined) ?? "";

  function locate() {
    const address = (formRef.current?.elements.namedItem("address") as HTMLInputElement | null)?.value ?? "";
    startLocate(async () => {
      setLocateMessage(null);
      const found = await locateAddressAction(address);
      if (found) {
        setPin(found);
        setSource("geocoded");
        setLocateMessage("Address located. Adjust the pin if it is off.");
      } else {
        setLocateMessage("Address not found. Click the map to set the pin by hand.");
      }
    });
  }

  function pick(next: PinValue) {
    setPin(next);
    setSource("manual");
  }

  function clearPin() {
    setPin(null);
    setSource(null);
  }

  return (
    <form ref={formRef} action={formAction} className="person-form" noValidate>
      {person ? <input type="hidden" name="id" value={person.id} /> : null}
      <input type="hidden" name="latitude" value={pin?.lat ?? ""} />
      <input type="hidden" name="longitude" value={pin?.lng ?? ""} />
      <input type="hidden" name="location_source" value={pin ? (source ?? "manual") : ""} />

      <div className="person-form-fields">
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            name="full_name"
            defaultValue={value("full_name")}
            maxLength={120}
            required
            aria-invalid={errors?.full_name ? true : undefined}
            aria-describedby={describedBy(errors, "full_name")}
          />
          <FieldError errors={errors} name="full_name" />
        </div>
        <div className="field">
          <label htmlFor="date_of_birth">Date of birth</label>
          <DateInput
            id="date_of_birth"
            name="date_of_birth"
            defaultValue={value("date_of_birth")}
            required
            aria-invalid={errors?.date_of_birth ? true : undefined}
            aria-describedby={describedBy(errors, "date_of_birth")}
          />
          <FieldError errors={errors} name="date_of_birth" />
        </div>
        <div className="field">
          <label htmlFor="mobile_phone">Mobile phone</label>
          <input
            id="mobile_phone"
            name="mobile_phone"
            type="tel"
            inputMode="tel"
            placeholder="0912 345 678"
            defaultValue={value("mobile_phone")}
            required
            aria-invalid={errors?.mobile_phone ? true : undefined}
            aria-describedby={describedBy(errors, "mobile_phone")}
          />
          <FieldError errors={errors} name="mobile_phone" />
        </div>
        <div className="field">
          <label htmlFor="address">Address</label>
          <textarea
            id="address"
            name="address"
            rows={3}
            defaultValue={value("address")}
            maxLength={300}
            required
            aria-invalid={errors?.address ? true : undefined}
            aria-describedby={describedBy(errors, "address")}
          />
          <FieldError errors={errors} name="address" />
        </div>
      </div>

      <fieldset className="person-form-pin">
        <legend className="hud-label">Pin</legend>
        <div className="pin-toolbar">
          <button type="button" className="btn" onClick={locate} disabled={locating}>
            {locating ? "Locating…" : "Locate address"}
          </button>
          <button type="button" className="btn btn-danger" onClick={clearPin} disabled={!pin}>
            Clear pin
          </button>
          <span className="hud-label" aria-live="polite">
            {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} · ${source ?? "manual"}` : "No pin"}
          </span>
        </div>
        {locateMessage ? (
          <p className="hud-label" role="status">
            {locateMessage}
          </p>
        ) : null}
        <PinPicker value={pin} onPick={pick} label="Pin location map" />
        <FieldError errors={errors} name="latitude" />
        <p className="hud-label">Without a pin, saving geocodes the address. If that fails, the record shows “no pin”.</p>
      </fieldset>

      {state && !state.ok && state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : person ? "Save changes" : "Create person"}
        </button>
      </div>
    </form>
  );
}
