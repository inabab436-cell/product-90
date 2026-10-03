/**
 * Mandatory basic product fields.
 *
 * The merchant may not save a product without its material, its price and at
 * least one colour row carrying a quantity: a product missing any of these
 * reaches the customer as an incomplete answer ("مش عارف الخامة/السعر") or as
 * a contradictory availability state.
 */

export function requireMaterial(raw: string): string {
  const value = String(raw ?? "").trim();
  if (value === "") throw new Error("اكتب خامة المنتج — الخانة إجبارية.");
  return value;
}

export function requirePrice(raw: string): number {
  const text = String(raw ?? "").trim();
  if (text === "") throw new Error("اكتب سعر المنتج — الخانة إجبارية.");
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("سعر المنتج يجب أن يكون رقماً أكبر من صفر.");
  }
  return n;
}

/** At least one colour row, so a quantity always exists for the product. */
export function requireVariantRows(count: number): void {
  if (count <= 0) {
    throw new Error("أضف لوناً واحداً على الأقل مع الكمية — الكمية إجبارية.");
  }
}

/** True when the basic fields are filled, used to enable the save button. */
export function basicFieldsFilled(input: {
  name: string;
  material: string;
  price: string;
  rows: number;
}): boolean {
  const price = Number(String(input.price).trim());
  return Boolean(
    input.name.trim() &&
      input.material.trim() &&
      String(input.price).trim() !== "" &&
      Number.isFinite(price) &&
      price > 0 &&
      input.rows > 0,
  );
}
