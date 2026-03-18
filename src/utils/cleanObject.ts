// src/utils/cleanObject.ts
export function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return undefined;

  // Limpa arrays
  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanObject(item))
      .filter((item) => item !== undefined);
  }

  // Limpa objetos
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      const value = cleanObject(obj[key]);
      if (value !== undefined) cleaned[key] = value;
    }
    return cleaned;
  }

  // Valores primitivos
  return obj;
}
