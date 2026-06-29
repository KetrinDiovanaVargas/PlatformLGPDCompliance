import crypto from "crypto";

interface CompressResult {
  compressed: string;
  hash: string;
  originalLength: number;
  compressedLength: number;
  savedTokens: number;
}

interface SessionStats {
  totalCompressed: number;
  totalOriginalLength: number;
  totalCompressedLength: number;
  estimatedTokensSaved: number;
}

const CHARS_PER_TOKEN = 4;

export class HeadroomService {
  private store = new Map<string, string>();
  private stats: SessionStats = {
    totalCompressed: 0,
    totalOriginalLength: 0,
    totalCompressedLength: 0,
    estimatedTokensSaved: 0,
  };

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

  retrieve(hash: string): string | null {
    return this.store.get(hash) ?? null;
  }

  getStats(): SessionStats {
    return { ...this.stats };
  }

  clear(): void {
    this.store.clear();
    this.stats = {
      totalCompressed: 0,
      totalOriginalLength: 0,
      totalCompressedLength: 0,
      estimatedTokensSaved: 0,
    };
  }

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

  private extractKeyLines(lines: string[]): string[] {
    const keywords = /error|erro|warn|crítico|falha|exception|score|resultado|total/i;
    return lines.filter((l) => keywords.test(l)).slice(0, 10);
  }
}

export const headroomService = new HeadroomService();
