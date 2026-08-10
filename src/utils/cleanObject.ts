

/**
 * Remove recursivamente valores null e undefined de objetos e arrays
 * Filtra arrays vazios após limpeza, reconstrói objetos sem propriedades undefined
 *
 * @param {any} obj - Objeto, array ou valor primitivo a limpar
 * @returns {any} Versão limpa do objeto/array, ou undefined se vazio após limpeza
 *
 * @example
 * cleanObject({ a: 1, b: undefined, c: null })
 * // → { a: 1 }
 *
 * @example
 * cleanObject([1, undefined, 3, null])
 * // → [1, 3]
 *
 * @example
 * cleanObject({ user: { name: 'João', email: undefined } })
 * // → { user: { name: 'João' } }
 */
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