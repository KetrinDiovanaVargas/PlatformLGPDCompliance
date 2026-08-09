/**
 * Serviço de compressão de conteúdo para otimização de tokens.
 * 
 * Comprime conteúdo longo mantendo pontos-chave, armazena original em cache
 * com hash SHA256 e rastreia economia de tokens na sessão.
 * @module lib/headroom-service
 */

import crypto from "crypto";

/**
 * Resultado de compressão de conteúdo.
 * @typedef {Object} CompressResult
 * @property {string} compressed - Conteúdo comprimido
 * @property {string} hash - Hash SHA256 do conteúdo original (16 caracteres)
 * @property {number} originalLength - Tamanho original em caracteres
 * @property {number} compressedLength - Tamanho comprimido em caracteres
 * @property {number} savedTokens - Tokens economizados (estimado)
 */
interface CompressResult {
  compressed: string;
  hash: string;
  originalLength: number;
  compressedLength: number;
  savedTokens: number;
}

/**
 * Estatísticas de compressão da sessão.
 * @typedef {Object} SessionStats
 * @property {number} totalCompressed - Total de conteúdos comprimidos
 * @property {number} totalOriginalLength - Soma dos tamanhos originais
 * @property {number} totalCompressedLength - Soma dos tamanhos comprimidos
 * @property {number} estimatedTokensSaved - Total de tokens economizados
 */
interface SessionStats {
  totalCompressed: number;
  totalOriginalLength: number;
  totalCompressedLength: number;
  estimatedTokensSaved: number;
}

/**
 * Fator de conversão: caracteres por token (aproximado).
 * @constant
 * @type {number}
 */
const CHARS_PER_TOKEN = 4;

/**
 * Serviço de compressão inteligente com cache por hash.
 * 
 * Comprime conteúdo longo (>30 linhas) removendo linhas redundantes
 * e mantendo cabeçalho, rodapé e linhas com palavras-chave (error, warn, score, etc).
 * Armazena original em store para recuperação via hash.
 */
export class HeadroomService {
  /**
   * Store de conteúdos originais indexados por hash.
   * @private
   * @type {Map<string, string>}
   */
  private store = new Map<string, string>();

  /**
   * Estatísticas acumuladas da sessão.
   * @private
   * @type {SessionStats}
   */
  private stats: SessionStats = {
    totalCompressed: 0,
    totalOriginalLength: 0,
    totalCompressedLength: 0,
    estimatedTokensSaved: 0,
  };

  /**
   * Comprime conteúdo e armazena original em cache.
   * 
   * Summariza conteúdo longo mantendo primeiras 10 linhas, últimas 5 linhas,
   * e até 10 linhas-chave do meio. Atualiza estatísticas.
   * 
   * @param {string} content - Conteúdo a comprimir
   * @returns {CompressResult} Resultado com conteúdo comprimido, hash e economia
   * 
   * @example
   * const result = service.compress(longText);
   * console.log(`Economizou ${result.savedTokens} tokens`);
   * // Recuperar original depois:
   * const original = service.retrieve(result.hash);
   */
  compress(content: string): CompressResult {
    const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);

    const compressed = this.summarize(content);

    this.store.set(hash, content);

    const saved = Math.max(0, content.length - compressed.length);
    this.stats.totalCompressed++;
    this.stats.totalOriginalLength += content.length;
    this.stats.totalCompressedLength += compressed.length;
    this.stats.estimatedTokensSaved += Math.floor(saved / CHARS_PER_TOKEN);

    return {
      compressed,
      hash,
      originalLength: content.length,
      compressedLength: compressed.length,
      savedTokens: Math.floor(saved / CHARS_PER_TOKEN),
    };
  }

  /**
   * Recupera conteúdo original pelo hash.
   * 
   * @param {string} hash - Hash SHA256 retornado por compress() (16 caracteres)
   * @returns {string|null} Conteúdo original ou null se não encontrado em cache
   * 
   * @example
   * const original = service.retrieve('a1b2c3d4e5f6g7h8');
   */
  retrieve(hash: string): string | null {
    return this.store.get(hash) ?? null;
  }

  /**
   * Retorna estatísticas acumuladas da sessão.
   * 
   * @returns {SessionStats} Cópia das estatísticas atuais
   * 
   * @example
   * const stats = service.getStats();
   * console.log(`${stats.estimatedTokensSaved} tokens economizados no total`);
   */
  getStats(): SessionStats {
    return { ...this.stats };
  }

  /**
   * Limpa cache e reseta estatísticas.
   * 
   * @returns {void}
   */
  clear(): void {
    this.store.clear();
    this.stats = {
      totalCompressed: 0,
      totalOriginalLength: 0,
      totalCompressedLength: 0,
      estimatedTokensSaved: 0,
    };
  }

  /**
   * Summariza conteúdo longo mantendo estrutura essencial.
   * 
   * Para conteúdo >30 linhas: mantém primeiras 10 e últimas 5,
   * extrai até 10 linhas-chave do meio (com palavras como error, score, etc).
   * 
   * @private
   * @param {string} content - Conteúdo a summarizar
   * @returns {string} Conteúdo summarizado com indicador de linhas omitidas
   */
  private summarize(content: string): string {
    const lines = content.split("\n");

    if (lines.length <= 30) return content;

    const head = lines.slice(0, 10);
    const tail = lines.slice(-5);
    const skipped = lines.length - 15;

    const middle = this.extractKeyLines(lines.slice(10, -5));

    return [
      ...head,
      `... [${skipped} linhas omitidas — use retrieve() para conteúdo completo] ...`,
      ...middle,
      ...tail,
    ].join("\n");
  }

  /**
   * Extrai linhas contendo palavras-chave (error, warn, score, etc).
   * 
   * @private
   * @param {string[]} lines - Array de linhas
   * @returns {string[]} Array de até 10 linhas-chave
   */
  private extractKeyLines(lines: string[]): string[] {
    const keywords = /error|erro|warn|crítico|falha|exception|score|resultado|total/i;
    return lines.filter((l) => keywords.test(l)).slice(0, 10);
  }
}

/**
 * Instância singleton do serviço de compressão.
 * @type {HeadroomService}
 */
export const headroomService = new HeadroomService();