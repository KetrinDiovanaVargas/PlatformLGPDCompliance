/**
 * Gerador de Relatórios de Conformidade LGPD.
 * 
 * Consolida dados dos 4 estágios de avaliação em relatórios executivos com
 * scores agregados (0-100), classificação de maturidade e recomendações priorizadas.
 * @module lib/report-generator
 */

/**
 * Relatório individual de um estágio de avaliação.
 * @typedef {Object} StageReport
 * @property {string} stageId - Identificador único do estágio
 * @property {string} title - Título do estágio
 * @property {number} score - Score de 0-100
 * @property {string[]} criticalIssues - Problemas críticos identificados
 * @property {string[]} strengths - Pontos fortes da organização
 * @property {string[]} attentionPoints - Áreas que requerem atenção
 * @property {Array<{title: string, priority: "Alta"|"Média"|"Baixa"}>} recommendations - Recomendações priorizadas
 * @property {Object} [risks] - Riscos associados (opcional)
 * @property {string} [summary] - Resumo textual (opcional)
 */
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

/**
 * Relatório consolidado de toda a avaliação de maturidade.
 * @typedef {Object} ConsolidatedReport
 * @property {string} sessionId - ID da sessão de avaliação
 * @property {string} userId - ID do respondente
 * @property {string} [assessmentId] - ID do questionário (opcional)
 * @property {string} generatedAt - ISO timestamp de geração
 * @property {number} overallScore - Score geral (0-100)
 * @property {"Crítico"|"Insuficiente"|"Parcial"|"Adequado"|"Exemplar"} complianceLevel - Nível de conformidade
 * @property {StageReport[]} stages - Relatórios dos 4 estágios
 * @property {Array<{label: string, count: number}>} topCriticalIssues - Top 5 problemas críticos
 * @property {Array<{label: string, count: number}>} topStrengths - Top 5 pontos fortes
 * @property {Array<{title: string, priority: string}>} topRecommendations - Top 10 recomendações
 * @property {string} executiveSummary - Resumo executivo textual
 */
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
 * Gerador de relatórios consolidados de conformidade LGPD.
 * 
 * Agrega scores dos 4 estágios, classifica nível de maturidade e consolida
 * recomendações/problemas para apresentação executiva.
 */
export class ReportGenerator {
  /**
   * Gera relatório consolidado a partir de dados dos estágios.
   * 
   * @param {string} sessionId - ID único da sessão de avaliação
   * @param {string} userId - ID do usuário/respondente
   * @param {StageReport[]} stages - Relatórios dos 4 estágios
   * @param {string} [assessmentId] - ID opcional do questionário
   * @returns {ConsolidatedReport} Relatório consolidado com score 0-100 e nível
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

  /**
   * Converte relatório consolidado para formato Markdown.
   * 
   * @param {ConsolidatedReport} report - Relatório a converter
   * @returns {string} Markdown formatado com seções de score, problemas, pontos fortes e etapas
   */
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

  /**
   * Calcula score médio dos estágios.
   * @private
   * @param {StageReport[]} stages - Array de estágios
   * @returns {number} Média arredondada (0-100)
   */
  private averageScore(stages: StageReport[]): number {
    if (!stages.length) return 0;
    const total = stages.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / stages.length);
  }

  /**
   * Classifica score em nível de conformidade (5 níveis).
   * @private
   * @param {number} score - Score de 0-100
   * @returns {ConsolidatedReport["complianceLevel"]} Nível de conformidade
   */
  private classifyCompliance(score: number): ConsolidatedReport["complianceLevel"] {
    if (score < 20) return "Crítico";
    if (score < 40) return "Insuficiente";
    if (score < 60) return "Parcial";
    if (score < 80) return "Adequado";
    return "Exemplar";
  }

  /**
   * Agrupa itens por frequência e retorna top N.
   * @private
   * @param {string[]} items - Array de strings a contar
   * @param {number} [limit=5] - Limite de resultados
   * @returns {Array<{label: string, count: number}>} Top itens ordenados por frequência
   */
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

  /**
   * Mescla recomendações dos estágios removendo duplicatas.
   * Prioriza por Alta > Média > Baixa.
   * @private
   * @param {StageReport[]} stages - Array de estágios
   * @returns {Array<{title: string, priority: string}>} Top 10 recomendações únicas
   */
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

  /**
   * Constrói resumo executivo em texto livre.
   * @private
   * @param {number} score - Score geral
   * @param {ConsolidatedReport["complianceLevel"]} level - Nível de conformidade
   * @param {StageReport[]} stages - Array de estágios
   * @returns {string} Parágrafo resumido da avaliação
   */
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

/**
 * Instância singleton do gerador de relatórios.
 * @type {ReportGenerator}
 */
export const reportGenerator = new ReportGenerator();