import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, getDocs } from "firebase/firestore";
import type { ConfusionMatrixData } from "@/components/ConfusionMatrix";

export type PersonaValidationSeed = {
  personaName: string;
  description: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  notes?: string;
};

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
 * Seed database com dados de validação de personas para demonstração
 * Verifica se dados já existem antes de inserir
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
 * Função auxiliar para limpar dados de personas (apenas para desenvolvimento)
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
