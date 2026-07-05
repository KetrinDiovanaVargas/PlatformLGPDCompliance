import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  DocumentData,
} from "firebase/firestore";
import type { ConfusionMatrixData } from "@/components/ConfusionMatrix";

export type PersonaValidation = {
  id: string;
  personaName: string;
  description?: string;
  assessmentId?: string;
  confusionMatrix: ConfusionMatrixData;
  timestamp?: any;
  notes?: string;
};

export type PersonasValidationStats = {
  totalPersonas: number;
  averageAccuracy: number;
  personas: PersonaValidation[];
};

/**
 * Hook para carregar dados de validação de personas do Firestore
 * Compara Esperado (Oráculo) vs Detectado (Sistema)
 */
export function usePersonasValidation(assessmentId?: string) {
  const [data, setData] = useState<PersonasValidationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPersonasValidation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let q;
      if (assessmentId) {
        q = query(
          collection(db, "personasValidation"),
          where("assessmentId", "==", assessmentId)
        );
      } else {
        q = query(collection(db, "personasValidation"));
      }

      const querySnapshot = await getDocs(q);
      const personas: PersonaValidation[] = [];

      querySnapshot.forEach((doc) => {
        const docData = doc.data() as DocumentData;
        personas.push({
          id: doc.id,
          personaName: docData.personaName || "Unknown",
          description: docData.description,
          assessmentId: docData.assessmentId,
          confusionMatrix: {
            truePositives: docData.truePositives || 0,
            falsePositives: docData.falsePositives || 0,
            falseNegatives: docData.falseNegatives || 0,
            trueNegatives: docData.trueNegatives || 0,
          },
          timestamp: docData.timestamp,
          notes: docData.notes,
        });
      });

      // Calcular acurácia média
      const accuracies = personas.map((p) => {
        const total =
          p.confusionMatrix.truePositives +
          p.confusionMatrix.falsePositives +
          p.confusionMatrix.falseNegatives +
          p.confusionMatrix.trueNegatives;
        return total > 0
          ? ((p.confusionMatrix.truePositives +
              p.confusionMatrix.trueNegatives) /
              total) *
              100
          : 0;
      });

      const averageAccuracy =
        accuracies.length > 0
          ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
          : 0;

      setData({
        totalPersonas: personas.length,
        averageAccuracy: Math.round(averageAccuracy * 10) / 10,
        personas,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar validação"
      );
      console.error("Error loading personas validation:", err);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    loadPersonasValidation();
  }, [loadPersonasValidation]);

  return { data, loading, error, refetch: loadPersonasValidation };
}
