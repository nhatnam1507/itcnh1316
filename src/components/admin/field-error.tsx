import type { FieldErrors } from "@/lib/validation/person-schema";

export function FieldError({ errors, name }: { errors?: FieldErrors; name: string }) {
  const messages = errors?.[name];
  if (!messages?.length) return null;
  return (
    <p id={`${name}-error`} className="field-error" role="alert">
      {messages[0]}
    </p>
  );
}

export function describedBy(errors: FieldErrors | undefined, name: string): string | undefined {
  return errors?.[name]?.length ? `${name}-error` : undefined;
}
