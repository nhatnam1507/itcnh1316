/** Lowercase, without Vietnamese diacritics, so "nguyen van ao" finds "Nguyễn Văn Ảo". */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every word of `query` appears somewhere in `fields`; an empty query matches everything. */
export function matchesSearch(query: string, ...fields: string[]): boolean {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchKey(fields.join(" "));
  return words.every((word) => haystack.includes(word));
}
