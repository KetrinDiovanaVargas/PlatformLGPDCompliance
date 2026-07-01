# Personas Sintéticas LGPD

Diretório com 50 personas sintéticas para validação do questionário dinâmico de fragilidades de tratamento de dados, conforme metodologia do material de apoio do Mestrado Profissional em Engenharia de Software.

## Estrutura

- **`/personas/`** — Arquivos `.md` com identidade, rotina, comportamentos e instruções para a LLM.  
- **`/oraculos/`** — Arquivos `.yml` com gabarito oculto: fragilidades esperadas, vetor de risco e critérios de sucesso.

> **Regra metodológica:** a LLM-persona recebe **apenas** o arquivo `.md`. O oráculo **não** deve ser entregue à LLM durante a simulação.

---

## Matriz de cobertura (50 personas)

| ID | Setor | Cargo | Fragilidade principal | Risco |
|----|-------|-------|-----------------------|-------|
| P01 | RH | Analista de Recrutamento | F1 Compartilhamento informal | Alto |
| P02 | RH | Analista de Folha de Pagamento | F3 Retenção excessiva | Alto |
| P03 | RH / Saúde | Técnico de Saúde Ocupacional | F9 Dados sensíveis | Crítico |
| P04 | Comercial | Vendedor Externo | F2 Armazenamento indevido | Alto |
| P05 | Comercial | Coordenador Comercial | F7 Uso secundário | Alto |
| P06 | Marketing | Analista de Marketing Digital | F7 Uso secundário | Moderado/Alto |
| P07 | Atendimento | Operador de SAC | F4 Coleta excessiva | Moderado |
| P08 | Atendimento | Supervisor de Atendimento | F1 Compartilhamento informal | Alto |
| P09 | Financeiro | Analista de Cobrança | F8 Terceiros sem controle | Crítico |
| P10 | Financeiro | Analista de Contas a Pagar | F1 Compartilhamento informal | Moderado/Alto |
| P11 | TI | Técnico de Suporte | F5 Acesso excessivo | Alto |
| P12 | TI | Administrador de Sistemas | F3 Retenção excessiva | Alto |
| P13 | Segurança | Analista de Segurança da Informação | F4 Coleta excessiva | Moderado |
| P14 | Operações | Supervisor de Campo | F2 Armazenamento indevido | Alto |
| P15 | Logística | Assistente de Logística | F1/F8 Compartilhamento/Terceiros | Alto |
| P16 | Jurídico | Assistente Jurídico | F8 Terceiros sem controle | Alto |
| P17 | Gestão | Gerente de Unidade | F4 Coleta excessiva | Moderado/Alto |
| P18 | Privacidade | Encarregado (DPO) Iniciante | F6 Falta de transparência | Moderado |
| P19 | RH / T&D | Analista de Treinamento | F8 Terceiros sem controle | Moderado |
| P20 | Compras | Analista de Compras | F4 Coleta excessiva | Moderado |
| P21 | Saúde | Recepcionista de Ambulatório | F9 Dados sensíveis | Alto |
| P22 | Contabilidade | Analista Contábil | F8 Terceiros sem controle | Moderado/Alto |
| P23 | Segurança Patrimonial | Vigilante / Porteiro | F2 Armazenamento indevido | Moderado |
| P24 | E-commerce | Analista de E-commerce | F6/F8 Transparência/Terceiros | Alto |
| P25 | Saúde | Técnico de Enfermagem | F9 Dados sensíveis | Alto |
| P26 | Produção | Líder de Produção | F5 Acesso excessivo | Alto |
| P27 | RH / Benefícios | Assistente Social Corporativo | F9/F5 Sensíveis/Acesso | Crítico |
| P28 | CRM | Analista de Relacionamento | F4 Coleta excessiva | Moderado/Alto |
| P29 | TI / Dev | Desenvolvedor Full Stack | F2 Armazenamento indevido | Alto |
| P30 | Contratos | Gestor de Outsourcing | F8 Terceiros sem controle | Alto |
| P31 | Publicidade | Analista de Agência (parceiro) | F2/F8 Armazenamento/Terceiros | Alto |
| P32 | Imóveis | Corretor de Imóveis | F2 Armazenamento indevido | Alto |
| P33 | Educação | Secretária Escolar | F9 Dados sensíveis (menores) | Crítico |
| P34 | Financeiro | Gerente Bancário | F1 Compartilhamento informal | Alto |
| P35 | Seguros | Corretor de Seguros | F9/F3 Sensíveis/Retenção | Crítico |
| P36 | Saúde | Médico Clínico | F9 Dados sensíveis | Crítico |
| P37 | Sindicato | Administrativo Sindical | F9 Filiação sindical | Alto |
| P38 | Alimentação | Gerente de Restaurante | F7 Uso secundário | Moderado/Alto |
| P39 | Condomínio | Síndico | F1 Compartilhamento informal | Alto |
| P40 | Saúde Mental | Psicóloga Clínica | F9/F2 Sensíveis/Armazenamento | Crítico |
| P41 | Farmácia | Atendente de Farmácia | F4/F9 Coleta/Sensíveis | Alto |
| P42 | Tecnologia | CEO de Startup | — Persona de controle — | **Baixo** |
| P43 | Saúde | Fisioterapeuta | F9/F2 Biometria/Armazenamento | Alto |
| P44 | Serviços | Supervisora de Limpeza | F2 Armazenamento indevido | Moderado |
| P45 | Telemarketing | Operador de Telemarketing | F4/F6 Coleta/Transparência | Alto |
| P46 | Educação | Professor Universitário | F6/F3 Transparência/Retenção | Moderado |
| P47 | Terceiro Setor | Coordenadora de ONG | — Persona de controle — | **Baixo** |
| P48 | Hotelaria | Recepcionista de Hotel | F3 Retenção excessiva | Alto |
| P49 | Consultoria RH | Consultora de RH Freelancer | F2/F8/F7 | Crítico |
| P50 | Privacidade | DPO Sênior Maduro | — Persona de controle — | **Baixo** |

---

## Eixos de fragilidade (F1–F10)

| Código | Fragilidade |
|--------|-------------|
| F1 | Compartilhamento informal |
| F2 | Armazenamento indevido |
| F3 | Retenção excessiva |
| F4 | Coleta excessiva |
| F5 | Acesso excessivo |
| F6 | Falta de transparência |
| F7 | Uso secundário |
| F8 | Terceiros sem controle |
| F9 | Dados sensíveis sem salvaguarda |
| F10 | Incidente mal tratado |

## Personas de controle (falsos positivos)

| ID | Persona | Finalidade |
|----|---------|------------|
| P42 | CEO de Startup (LGPD madura) | Testar se sistema evita falso positivo em empresa bem estruturada |
| P47 | Coordenadora de ONG | Testar falso positivo em organização do terceiro setor |
| P50 | DPO Sênior Maduro | Testar falso positivo mais crítico — máxima maturidade de privacidade |

## Protocolo de uso

1. Selecionar persona `.md`
2. Instruir a LLM a assumir integralmente a persona
3. Executar sessão com o questionário dinâmico
4. Registrar todas as perguntas, respostas, ramificações e diagnóstico final
5. Comparar saída com oráculo oculto `.yml`
6. Atribuir pontuação pela rubrica (0–3 por critério)
7. Repetir ao menos 2x para personas críticas (temperatura 0,2–0,3)
