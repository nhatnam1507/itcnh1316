import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClassnetEmblem } from "@/components/brand/classnet-emblem";
import { DecryptText } from "@/components/fx/decrypt-text";
import { HoloGlobe } from "@/components/fx/holo-globe/holo-globe";
import { UnlockHud } from "@/components/fx/hud/unlock-hud";
import { TiltSection } from "@/components/fx/tilt-section";
import { hasClassAccess } from "@/lib/passcode/class-session";
import { UnlockForm } from "./unlock-form";

export const metadata: Metadata = { title: "CLASSNET // Unlock" };

export default async function UnlockPage() {
  if (await hasClassAccess()) redirect("/");

  return (
    <main className="unlock-screen">
      <p className="classified-banner classified-banner-fixed" aria-hidden="true">
        Top secret // Eyes only // Classnet
      </p>
      <HoloGlobe />
      <UnlockHud />
      <p className="globe-readout hud-label" aria-hidden="true">
        <span className="rec-dot" />
        Tracking 3 signals · Hà Nội 21.03°N 105.85°E
      </p>
      <TiltSection className="unlock-card panel-frame" aria-labelledby="unlock-title">
        <span className="stamp" aria-hidden="true">
          Top secret
        </span>
        <div className="card-brand">
          <ClassnetEmblem className="card-emblem" />
          <p className="hud-label">Secure terminal · Restricted</p>
        </div>
        <ol className="boot-log" aria-hidden="true">
          <li>
            Establishing secure channel <b>OK</b>
          </li>
          <li>
            Verifying terminal fingerprint <b>OK</b>
          </li>
          <li>
            Clearance required <b>CLASSMATE</b>
          </li>
          <li>Awaiting passcode</li>
        </ol>
        <h1 id="unlock-title" className="grad-text">
          <DecryptText text="CLASSNET" duration={1200} />
        </h1>
        <p>Enter the class passcode to access the directory.</p>
        <UnlockForm />
      </TiltSection>
      <p className="classified-banner classified-banner-fixed classified-banner-bottom" aria-hidden="true">
        Top secret // Eyes only // Classnet
      </p>
      <div className="fx-crt" aria-hidden="true" />
    </main>
  );
}
