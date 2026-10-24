"use client";

import type { ComponentProps } from "react";
import { usePointerTilt } from "./use-pointer-tilt";

/** A <section> that tilts toward the pointer; lets server components use the effect. */
export function TiltSection({ className, ...props }: ComponentProps<"section">) {
  const ref = usePointerTilt<HTMLElement>();
  return <section ref={ref} className={`${className ?? ""} tilt`} {...props} />;
}
