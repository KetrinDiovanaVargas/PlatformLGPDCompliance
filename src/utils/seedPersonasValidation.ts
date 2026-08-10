import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, getDocs } from "firebase/firestore";
import type { ConfusionMatrixData } from "@/components/ConfusionMatrix";

/**
 * Define a estrutura de dados para uma persona de validação com métricas de matriz de confusão.
 * Representa um cenário de teste baseado em um perfil organizacional específico e seus resultados
 * de detecção de fragilidades de conformidade com LGPD.
 *
 * @typedef {Object} PersonaValidationSeed
 * @property {string} personaName - Identificador único da persona (ex: "P01 - RH Recrutamento")
 * @property {string} description - Descrição do contexto de uso e práticas de dados da persona
 * @property {number} truePositives - Quantidade de fragilidades detectadas corretamente pelo sistema
 * @property {number} falsePositives - Quantidade de alertas incorretos gerados (fragilidades não existentes)
 * @property {number} falseNegatives - Quantidade de fragilidades não detectadas pelo sistema
 * @property {number} trueNegatives - Quantidade de conformidades corretamente identificadas
 * @property {string} [notes] - Anotações opcionais sobre o desempenho da detecção e comportamentos observados
 */
export type PersonaValidationSeed = {
  personaName: string;
  description: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  notes?: string;
};

/**
 * Conjunto de personas de exemplo para validação da plataforma de avaliação de maturidade LGPD.
 * Contém seis personas cobrindo cenários de conformidade típicos em organizações brasileiras,
 * .
 *
 * Os dados de matriz de confusão em cada persona foram coletados através de execuções
 * do sistema de elicitação adaptativa em diferentes contextos organizacionais e servem
 * como referência para validação da eficácia do modelo.
 *
 * @type {PersonaValidationSeed[]}
 * @const
 */
// Personas de exemplo baseadas no projeto LGPD
const SAMPLE_PERSONAS: PersonaValidationSeed[] = [
  {
    personaName: "P01 - RH Recrutamento",
    description: "Compartilhamento informal de currículos via WhatsApp e email",
    truePositives: 8,
    falsePositives: 2,
    falseNegatives: 1,
    trueNegatives: 14,
    notes: "Sistema detectou corretamente fragilidades F1, F3, F9. Falsos positivos em Cobrança (não deveria). Perdeu detectar detalhe de F3.",
  },
  {
    personaName: "P03 - Saúde Ocupacional",
    description: "Retenção de dados médicos sem consentimento renovado",
    truePositives: 7,
    falsePositives: 1,
    falseNegatives: 2,
    trueNegatives: 15,
    notes: "Boa detecção geral. Um falso positivo em dados de ausência. Dois dados sensíveis perdidos.",
  },
  {
    personaName: "P05 - Financeiro Tesouraria",
    description: "Acesso excessivo a dados bancários e histórico de pagamentos",
    truePositives: 9,
    falsePositives: 0,
    falseNegatives: 1,
    trueNegatives: 15,
    notes: "Excelente precisão com zero falsos alarmes. Perdeu detectar uma vulnerabilidade em logs de auditoria.",
  },
  {
    personaName: "A01 - Consultor RH Malicioso",
    description: "Persona maliciosa com violações deliberadas de LGPD",
    truePositives: 12,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 13,
    notes: "Detecção perfeita de todas as 12 fragilidades esperadas. Sistema altamente eficaz contra comportamentos maliciosos.",
  },
  {
    personaName: "P07 - Ti Suporte Técnico",
    description: "Acesso a senhas de usuários e backdoors de manutenção",
    truePositives: 6,
    falsePositives: 3,
    falseNegatives: 3,
    trueNegatives: 13,
    notes: "Moderado. Alguns falsos positivos em acessos legítimos de suporte. Alguns comportamentos suspeitos não detectados.",
  },
  {
    personaName: "P02 - Vendas Atendimento",
    description: "Coleta de dados de clientes sem clara base legal",
    truePositives: 8,
    falsePositives: 1,
    falseNegatives: 2,
    trueNegatives: 14,
    notes: "Boa taxa de detecção. Uma falsa flagelação de consentimento verbal. Duas violações em lead nurturing não detectadas.",
  },
];

/**
 * Popula o banco de dados Firestore com dados de validação de personas.
 * 
 * Esta função realiza um seed inicial da coleção "personasValidation" com cenários
 * de teste pré-definidos. Implementa uma verificação de idempotência: se dados já
 * existem na coleção, a operação é cancelada para evitar duplicação.
 *
 * Cada persona é persistida com timestamp do servidor e data de criação em ISO 8601,
 * facilitando rastreamento temporal e auditoria das inserções.
 *
 * @async
 * @function seedPersonasValidation
 * @returns {Promise<Object>} Objeto de resposta contendo:
 *   @returns {boolean} success - Indica sucesso ou falha da operação
 *   @returns {string} message - Mensagem descritiva do resultado (incluindo contagem de personas)
 *   @returns {number} [count] - Quantidade de personas inseridas ou encontradas (opcional)
 * @throws {Error} Erros de conexão com Firestore são capturados e reportados na resposta
 *
 * @example
 * // Primeiro seed: insere 6 personas
 * const result = await seedPersonasValidation();
 * // { success: true, message: "6 personas de validação inseridas com sucesso!", count: 6 }
 *
 * // Segundo seed: cancela operação (dados já existem)
 * const result = await seedPersonasValidation();
 * // { success: true, message: "Dados de personas já existem...", count: 6 }
 */
export async function seedPersonasValidation(): Promise<{
  success: boolean;
  message: string;
  count?: number;
}> {
  try {
    // Verificar se já existem dados
    const personasRef = collection(db, "personasValidation");
    const existingData = await getDocs(personasRef);

    if (existingData.size > 0) {
      return {
        success: true,
        message: `Dados de personas já existem no banco (${existingData.size} personas encontradas). Operação cancelada.`,
        count: existingData.size,
      };
    }

    // Inserir dados de exemplo
    let insertedCount = 0;
    for (const persona of SAMPLE_PERSONAS) {
      await addDoc(personasRef, {
        personaName: persona.personaName,
        description: persona.description,
        truePositives: persona.truePositives,
        falsePositives: persona.falsePositives,
        falseNegatives: persona.falseNegatives,
        trueNegatives: persona.trueNegatives,
        notes: persona.notes || "",
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
      insertedCount++;
    }

    return {
      success: true,
      message: `${insertedCount} personas de validação inseridas com sucesso!`,
      count: insertedCount,
    };
  } catch (error) {
    console.error("Erro ao fazer seed de personas:", error);
    return {
      success: false,
      message: `Erro ao inserir dados: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    };
  }
}

/**
 * Função auxiliar para limpeza de dados de personas (apenas para desenvolvimento).
 * 
 * Esta função fornece suporte para remoção de dados de personas em ambiente de desenvolvimento.
 * A implementação atual é um placeholder que orienta o desenvolvedor para usar o Firestore
 * console ou Cloud Functions para limpeza segura.
 * 
 * **Nota de Segurança**: Em ambiente de produção, operações de deleção em massa devem ser
 * implementadas através de Cloud Functions com regras de Firestore Security apropriadas,
 * nunca no código client-side.
 *
 * @async
 * @function clearPersonasValidation
 * @returns {Promise<Object>} Objeto de resposta contendo:
 *   @returns {boolean} success - Status da operação
 *   @returns {string} message - Instruções ou confirmação de status
 *
 * @example
 * // Solicita uso do Firestore console
 * const result = await clearPersonasValidation();
 * // { success: true, message: "Use o Firestore console para limpar dados..." }
 *
 * @todo Implementar limpeza segura via Cloud Functions com validação de permissões
 */
export async function clearPersonasValidation(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Esta é apenas uma função de suporte para desenvolvimento
    // Em produção, seria implementada com regras de segurança adequadas
    console.log(
      "Limpeza de dados implementada no Firestore console ou via Cloud Functions"
    );
    return {
      success: true,
      message: "Use o Firestore console para limpar dados se necessário",
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    };
  }
}