/** Decorative ID-card codes for the dossier. Each one is derived from the person's real record. */

const MRZ_LINE = 30;

/** First letter of the family name and of the given name: `Nguyễn Văn Ảo` → `NẢ`. */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("vi");
}

/** The last six hex digits of the record id: `…-000000000001` → `000001`. */
export function subjectCode(id: string): string {
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}

/** Uppercase A–Z, 0–9 and `<` only, as a passport's machine-readable zone allows. */
function mrzText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<");
}

function mrzLine(value: string): string {
  return value.slice(0, MRZ_LINE).padEnd(MRZ_LINE, "<");
}

/**
 * Two passport-style lines: family name and given names, then the birth date (YYMMDD)
 * and subject code. `Nguyễn Văn Ảo` → `CN<VNM<NGUYEN<<VAN<AO<<<<<<<<<`.
 */
export function machineReadableZone(person: { id: string; full_name: string; date_of_birth: string }): [string, string] {
  const [family = "", ...given] = person.full_name.trim().split(/\s+/);
  const [year, month, day] = person.date_of_birth.split("-");
  return [
    mrzLine(`CN<VNM<${mrzText(family)}<<${mrzText(given.join(" "))}`),
    mrzLine(`${year.slice(-2)}${month}${day}<${subjectCode(person.id)}<<CLASSNET`),
  ];
}

/** Bar widths for a barcode that encodes `text`: three bars per character, 1–3 units wide. */
export function barcodeBars(text: string): { x: number; width: number }[] {
  const bars: { x: number; width: number }[] = [];
  let x = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    for (const shift of [0, 2, 4]) {
      const width = ((code >> shift) % 3) + 1;
      bars.push({ x, width });
      x += width + ((code >> (shift + 1)) % 2) + 1;
    }
  }
  return bars;
}
