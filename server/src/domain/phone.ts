// Jordanian mobile numbers (owner request): 07[789] + 7 digits, written any common way → "+9627XXXXXXXX".
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s\-().]/g, '');
  const m = /^(?:\+962|00962|962|0)?(7[789]\d{7})$/.exec(s);
  return m ? `+962${m[1]}` : null;
}
