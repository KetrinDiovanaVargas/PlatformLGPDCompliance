# 🔄 Exemplo Visual: Framework v1.0 vs v2.0

## Comparação Lado a Lado

### **ESTÁGIO 1: Levantamento Inicial**

#### v1.0 (Original)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 1: Contexto Geral (4 perguntas)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Como você armazena dados pessoais de clientes?        │
│    ├─ Seguro                                               │
│    ├─ Inseguro                                             │
│    └─ Parcialmente                                         │
│                                                             │
│ 2️⃣  Você compartilha dados com terceiros?                 │
│    ├─ Sim                                                  │
│    ├─ Não                                                  │
│    └─ Às vezes                                             │
│                                                             │
│ 3️⃣  Há contratos de proteção?                             │
│    ├─ Sim                                                  │
│    ├─ Não                                                  │
│    └─ Não sei                                              │
│                                                             │
│ 4️⃣  Qual seu nível de conformidade LGPD?                 │
│    ├─ Alto                                                 │
│    ├─ Médio                                                │
│    ├─ Baixo                                                │
│    └─ Crítico                                              │
│                                                             │
│ ⚠️  Abordagem: PRESCRITIVA (presume conformidade)          │
│    Foco: RESULTADO (como está agora)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### v2.0 (Novo)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 1: Contexto Organizacional (4 perguntas)          │
│ 📋 Dimensão (Tabela 7): Contexto, rotina e relação        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Com que frequência sua org. realiza contato com       │
│    dados pessoais em suas atividades diárias?              │
│    ├─ Continuamente                                        │
│    ├─ Frequentemente                                       │
│    ├─ Ocasionalmente                                       │
│    └─ Raramente                                            │
│    🎯 Objetivo: Avaliar volume e criticidade              │
│                                                             │
│ 2️⃣  Qual é a percepção geral da sua org. sobre            │
│    importância da proteção de dados?                       │
│    ├─ Prioritária                                          │
│    ├─ Importante                                           │
│    ├─ Considerada                                          │
│    └─ Negligenciada                                        │
│    🎯 Objetivo: Avaliar cultura de privacidade            │
│                                                             │
│ 3️⃣  Qual cenário descreve melhor a relação da sua        │
│    área com dados pessoais?                                │
│    ├─ Coleta e processamento                              │
│    ├─ Apenas acesso                                        │
│    ├─ Armazenamento                                        │
│    └─ Não interage diretamente                            │
│    🎯 Objetivo: Mapear tipo de atividade                  │
│                                                             │
│ 4️⃣  Como você descreveria nível de conhecimento da        │
│    sua equipe sobre regulamentações?                       │
│    ├─ Muito bem informada                                 │
│    ├─ Adequadamente informada                             │
│    ├─ Minimamente informada                               │
│    └─ Sem conhecimento                                     │
│    🎯 Objetivo: Avaliar capacidade interna                │
│                                                             │
│ ✅  Abordagem: DESCRITIVA (sem pressupostos)              │
│    Foco: DIAGNÓSTICO (qual é o estado atual)             │
│    Referência: Tabela 7 da Dissertação                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **ESTÁGIO 2: Operações**

#### v1.0 (Original)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 2: Operações (2 perguntas)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Como você obtém consentimento para coletar dados?     │
│    ├─ Explícito                                            │
│    ├─ Implícito                                            │
│    └─ Não obtém                                            │
│                                                             │
│ 2️⃣  Você monitora acesso aos dados?                       │
│    ├─ Sim                                                  │
│    ├─ Não                                                  │
│    └─ Parcialmente                                         │
│                                                             │
│ ⚠️  Foco: Consentimento + Monitoramento                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### v2.0 (Novo)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 2: Controles e Processos (3 perguntas)            │
│ 📋 Dimensão: Coleta, uso, acesso, armazenamento           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Quais controles sua org. possui para limitar         │
│    acesso aos dados pessoais?                              │
│    ├─ Rigorosos e documentados                            │
│    ├─ Básicos mas implementados                           │
│    ├─ Informais                                            │
│    └─ Inexistentes                                         │
│    🎯 Objetivo: Avaliar IAM (Identity & Access Mgmt)      │
│                                                             │
│ 2️⃣  Como sua org. documenta e rastreia a circulação      │
│    de dados pessoais?                                      │
│    ├─ Sistema automatizado                                │
│    ├─ Registros manuais estruturados                     │
│    ├─ Registros parciais                                  │
│    └─ Sem documentação                                     │
│    🎯 Objetivo: Avaliar rastreabilidade                   │
│                                                             │
│ 3️⃣  Quais medidas de segurança são aplicadas ao           │
│    armazenamento de dados pessoais?                        │
│    ├─ Criptografia + isolamento de rede                   │
│    ├─ Criptografia parcial                                │
│    ├─ Apenas controle de acesso                          │
│    └─ Nenhuma medida técnica                              │
│    🎯 Objetivo: Avaliar proteção em repouso              │
│                                                             │
│ ✅  Foco: Controles técnicos + Rastreabilidade            │
│    Referência: Tabela 7 da Dissertação                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **ESTÁGIO 3: Governança**

#### v1.0 (Original)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 3: Conformidade (2 perguntas)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Qual tempo de retenção dos dados?                    │
│    ├─ < 6 meses                                            │
│    ├─ 6-12 meses                                           │
│    └─ > 1 ano                                              │
│                                                             │
│ 2️⃣  Há direito de acesso/correção?                       │
│    ├─ Sim                                                  │
│    ├─ Não                                                  │
│    └─ Parcialmente                                         │
│                                                             │
│ ⚠️  Foco: Direitos de indivíduos                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### v2.0 (Novo)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 3: Riscos e Governança (3 perguntas)              │
│ 📋 Dimensão: Responsabilidades, compartilhamento,         │
│              dependências                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Sua org. compartilha dados com terceiros?             │
│    Se sim, como gerencia esse compartilhamento?            │
│    ├─ Com contratos formais                               │
│    ├─ Com acordo informal                                 │
│    ├─ Sem controle específico                             │
│    └─ Não compartilha                                      │
│    🎯 Objetivo: Avaliar risco de terceiros                │
│                                                             │
│ 2️⃣  Como são definidas as responsabilidades pelos         │
│    dados pessoais dentro da org.?                          │
│    ├─ Claramente atribuídas                               │
│    ├─ Parcialmente definidas                              │
│    ├─ Implícitas                                          │
│    └─ Não definidas                                        │
│    🎯 Objetivo: Avaliar estrutura de governança           │
│                                                             │
│ 3️⃣  Qual é o estado das dependências técnicas ou          │
│    processuais que afetam proteção de dados?               │
│    ├─ Bem mapeadas e gerenciadas                          │
│    ├─ Identificadas mas não gerenciadas                   │
│    ├─ Parcialmente conhecidas                             │
│    └─ Desconhecidas                                        │
│    🎯 Objetivo: Avaliar riscos operacionais               │
│                                                             │
│ ✅  Foco: Governança + Riscos de Terceiros               │
│    Referência: Tabela 7 da Dissertação                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **ESTÁGIO 4: Maturidade**

#### v1.0 (Original)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 4: Síntese (2 perguntas)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Houve incidente de segurança?                         │
│    ├─ Sim                                                  │
│    ├─ Não                                                  │
│    └─ Não sabe                                             │
│                                                             │
│ 2️⃣  Qual sua avaliação final de risco?                   │
│    ├─ Baixo                                                │
│    ├─ Moderado                                             │
│    ├─ Alto                                                 │
│    └─ Crítico                                              │
│                                                             │
│ ⚠️  Foco: Histórico de incidentes                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### v2.0 (Novo)
```
┌─────────────────────────────────────────────────────────────┐
│ ESTÁGIO 4: Maturidade e Evidências (3 perguntas)          │
│ 📋 Dimensão: Políticas, prevenção, revisão, monitoramento│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣  Sua org. possui políticas documentadas de              │
│    proteção e privacidade de dados?                        │
│    ├─ Sim, abrangentes                                    │
│    ├─ Sim, básicas                                        │
│    ├─ Parcialmente                                        │
│    └─ Não                                                  │
│    🎯 Objetivo: Avaliar formalização de controles        │
│                                                             │
│ 2️⃣  Com que frequência sua org. realiza revisões ou       │
│    auditorias de segurança de dados?                       │
│    ├─ Regularmente (anual)                                │
│    ├─ Ocasionalmente                                      │
│    ├─ Raramente                                            │
│    └─ Nunca                                                │
│    🎯 Objetivo: Avaliar monitoramento contínuo            │
│                                                             │
│ 3️⃣  Qual é o grau de maturidade geral dos controles      │
│    de proteção de dados na sua org.?                       │
│    ├─ Avançado                                             │
│    ├─ Intermediário                                       │
│    ├─ Básico                                               │
│    └─ Inicial/Inexistente                                 │
│    🎯 Objetivo: Auto-avaliação de maturidade              │
│                                                             │
│ ✅  Foco: Documentação + Auditorias + Maturidade          │
│    Referência: Tabela 7 da Dissertação                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Resumo de Mudanças

| Aspecto | v1.0 | v2.0 | Mudança |
|---------|------|------|---------|
| **Total de Perguntas** | 10 | 13 | +3 |
| **E1: Quantidade** | 4 | 4 | — |
| **E2: Quantidade** | 2 | 3 | +1 |
| **E3: Quantidade** | 2 | 3 | +1 |
| **E4: Quantidade** | 2 | 3 | +1 |
| **Abordagem** | Prescritiva | Descritiva | ✅ |
| **Pressupostos** | Sim | Não | ✅ |
| **Alinhamento Tabela 7** | ~60% | 100% | ✅ |

---

## 🎯 Diferenças de Propósito

### v1.0: "Como está a conformidade?"
- Pergunta o que foi implementado
- Presume que a organização já conhece as exigências
- Foco em resultado/status atual
- Menos útil para diagnóstico inicial

### v2.0: "Qual é o estado atual da proteção?"
- Pergunta como está organizado/documentado
- Não presume conhecimento prévio
- Foco em entender o estado real
- Mais útil para diagnóstico abrangente

---

## 📌 Conclusão

v2.0 representa uma **evolução metodológica** significativa:
- ✅ Mais alinhado com dissertação
- ✅ Melhor cobertura de LGPD/GDPR
- ✅ Abordagem menos prescritiva
- ✅ Melhor para diagnóstico inicial
- ✅ Perguntas mais específicas e acionáveis

