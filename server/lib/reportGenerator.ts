/**
 * Gerador de Relatórios de Conformidade LGPD
 * 
 * Módulo responsável pela geração de relatórios consolidados de avaliação de maturidade
 * em proteção de dados. Classifica conformidade em 5 níveis (Crítico/Insuficiente/Parcial/Adequado/Exemplar)
 * baseado em scores de 0-100 dos 4 estágios de avaliação.
 */

/** Interface que representa relatório de um estágio individual */
interface StageReport {
  stageId: string;
  title: string;
  score: number;
  criticalIssues: string[];
  strengths: string[];
  attentionPoints: string[];
  recommendations: Array<{ title: string; priority: "Alta" | "Média" | "Baixa" }>;
  risks?: Record<string, unknown>;
  summary?: string;
}

/** Interface que representa relatório consolidado de toda a avaliação */
interface ConsolidatedReport {
  sessionId: string;
  userId: string;
  assessmentId?: string;
  generatedAt: string;
  overallScore: number;
  complianceLevel: "Crítico" | "Insuficiente" | "Parcial" | "Adequado" | "Exemplar";
  stages: StageReport[];
  topCriticalIssues: Array<{ label: string; count: number }>;
  topStrengths: Array<{ label: string; count: number }>;
  topRecommendations: Array<{ title: string; priority: string }>;
  executiveSummary: string;
}

/**
 * Classe ReportGenerator
 * 
 * Responsável por gerar e formatar relatórios de conformidade LGPD.
 * Consolida dados dos 4 estágios em um relatório executivo com scores agregados,
 * classificação de maturidade e recomendações priorizadas.
 * 
 * @class
 */
export class ReportGenerator {
  /**
   * Gera relatório consolidado a partir de dados dos estágios
   * 
   * Agrega scores dos 4 estágios, calcula conformidade geral (0-100),
   * classifica nível de maturidade e consolida recomendações/problemas.
   * 
   * @param {string} sessionId - ID único da sessão de avaliação
   * @param {string} userId - ID do usuário/respondente
   * @param {StageReport[]} stages - Array com relatórios dos 4 estágios (Contexto, Controles, Riscos, Maturidade)
   * @param {string} [assessmentId] - ID opcional do questionário/avaliação
   * @returns {ConsolidatedReport} Relatório consolidado com score 0-100 e nível de conformidade
   * 
   * @example
   * const report = generator.generate('sess_001', 'user_123', stageReports);
   * console.log(report.overallScore); // 75
   * console.log(report.complianceLevel); // "Adequado"
   */
  generate(
    sessionId: string,
    userId: string,
    stages: StageReport[],
    assessmentId?: string
  ): ConsolidatedReport {
    const overallScore = this.averageScore(stages);
    const complianceLevel = this.classifyCompliance(overallScore);

    return {
      sessionId,
      userId,
      assessmentId,
      generatedAt: new Date().toISOString(),
      overallScore,
      complianceLevel,
      stages,
      topCriticalIssues: this.topFrequent(stages.flatMap((s) => s.criticalIssues)),
      topStrengths: this.topFrequent(stages.flatMap((s) => s.strengths)),
      topRecommendations: this.mergeRecommendations(stages),
      executiveSummary: this.buildSummary(overallScore, complianceLevel, stages),
    };
  }

  toMarkdown(report: ConsolidatedReport): string {
    const lines: string[] = [
      `# Relatório de Conformidade LGPD`,
      ``,
      `**Sessão:** ${report.sessionId}  `,
      `**Usuário:** ${report.userId}  `,
      `**Gerado em:** ${new Date(report.generatedAt).toLocaleString("pt-BR")}  `,
      ``,
      `## Pontuação Geral`,
      ``,
      `**${report.overallScore}/100** — Nível: **${report.complianceLevel}**`,
      ``,
      `## Resumo Executivo`,
      ``,
      report.executiveSummary,
      ``,
    ];

    if (report.topCriticalIssues.length > 0) {
      lines.push(`## Principais Problemas Críticos`, ``);
      report.topCriticalIssues.forEach(({ label, count }) =>
        lines.push(`- ${label} *(${count}x)*`)
      );
      lines.push(``);
    }

    if (report.topStrengths.length > 0) {
      lines.push(`## Pontos Fortes`, ``);
      report.topStrengths.forEach(({ label, count }) =>
        lines.push(`- ${label} *(${count}x)*`)
      );
      lines.push(``);
    }

    if (report.topRecommendations.length > 0) {
      lines.push(`## Recomendações`, ``);
      report.topRecommendations.forEach(({ title, priority }) =>
        lines.push(`- [${priority}] ${title}`)
      );
      lines.push(``);
    }

    lines.push(`## Etapas Avaliadas`, ``);
    report.stages.forEach((stage) => {
      lines.push(`### ${stage.title}`, `Score: **${stage.score}/100**`, ``);
      if (stage.summary) lines.push(stage.summary, ``);
    });

    return lines.join("\n");
  }

  private averageScore(stages: StageReport[]): number {
    if (!stages.length) return 0;
    const total = stages.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / stages.length);
  }

  private classifyCompliance(score: number): ConsolidatedReport["complianceLevel"] {
    if (score < 20) return "Crítico";
    if (score < 40) return "Insuficiente";
    if (score < 60) return "Parcial";
    if (score < 80) return "Adequado";
    return "Exemplar";
  }

  private topFrequent(items: string[], limit = 5): Array<{ label: string; count: number }> {
    const freq: Record<string, number> = {};
    for (const item of items) {
      const key = item.trim();
      if (!key) continue;
      freq[key] = (freq[key] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));
  }

  private mergeRecommendations(
    stages: StageReport[]
  ): Array<{ title: string; priority: string }> {
    const seen = new Set<string>();
    const result: Array<{ title: string; priority: string }> = [];

    const priorityOrder = { Alta: 0, Média: 1, Baixa: 2 };
    const all = stages
      .flatMap((s) => s.recommendations)
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    for (const rec of all) {
      const key = rec.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(rec);
      if (result.length >= 10) break;
    }

    return result;
  }

  private buildSummary(
    score: number,
    level: ConsolidatedReport["complianceLevel"],
    stages: StageReport[]
  ): string {
    const stageCount = stages.length;
    const criticalCount = stages.filter((s) => s.score < 40).length;

    return (
      `A avaliação abrangeu ${stageCount} etapa(s) e resultou em pontuação geral de ` +
      `${score}/100, classificada como "${level}". ` +
      (criticalCount > 0
        ? `${criticalCount} etapa(s) apresentaram desempenho crítico e requerem ação imediata. `
        : `Nenhuma etapa com desempenho crítico foi identificada. `) +
      `Consulte as recomendações para priorizar melhorias e alcançar maior conformidade com a LGPD.`
    );
  }
}

export const reportGenerator = new ReportGenerator();
