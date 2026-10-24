"use client";

import { useState, type ChangeEvent } from "react";
import { formatDate, parseDayFirstDate } from "@/lib/format";

type DateInputProps = {
  id: string;
  /** Name of the hidden field that carries the ISO date to the server. */
  name: string;
  /** ISO date (`1998-03-14`), or what the user typed before a failed submit. */
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const display = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value);

/**
 * Day-first date field (dd/mm/yyyy), where the browser's date picker would follow the
 * system locale and often show mm/dd/yyyy. Slashes are added as the user types. The server
 * receives ISO in a hidden field, or the raw text when it does not parse, so validation can
 * say what is wrong.
 */
export function DateInput({ id, name, defaultValue = "", required, placeholder = "dd/mm/yyyy", ...aria }: DateInputProps) {
  const [text, setText] = useState(() => display(defaultValue));
  const iso = parseDayFirstDate(text);

  function change(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    const typing = next.length > text.length;
    setText(typing && /^\d{2}$|^\d{2}\/\d{2}$/.test(next) ? `${next}/` : next);
  }

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={placeholder}
        maxLength={10}
        value={text}
        onChange={change}
        onBlur={() => iso && setText(formatDate(iso))}
        required={required}
        {...aria}
      />
      <input type="hidden" name={name} value={iso ?? text.trim()} />
    </>
  );
}
