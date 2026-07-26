# Instalação e Integração - Framework v2.0

## 📋 Sumário

Este guia explica como integrar o framework v2.0 à plataforma KETRIN.

## 🚀 Início Rápido

### 1. Clonar a Branch
```bash
git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
cd PlatformLGPDCompliance
git checkout feature/framework-v2.0
```

### 2. Estrutura de Diretórios
```
docs/
├── framework-v2.0/
│   ├── README.md                    # Guia do v2.0
│   ├── NOVO_FRAMEWORK_v2.0.md      # Documentação técnica
│   ├── EXEMPLO_VISUAL_v1_vs_v2.md  # Comparação visual
│   ├── ÍNDICE_COMPLETO.md          # Mapa de navegação
│   └── relatorio_logs_2026_07_02.md # Análise v1.0

logs/
├── 2026-07-02/          # v1.0 (original)
└── 2026-07-02-v2.0/     # v2.0 (novo) ← USE ESTE
    ├── A01_sessao_01.json
    ├── A02_sessao_01.json
    ├── ...
    ├── P49_sessao_01.json
    └── P50_sessao_01.json
```

## 📦 Conteúdo Incluído

### Documentação (5 arquivos)
- **NOVO_FRAMEWORK_v2.0.md** - Principal (12 KB)
  - Estrutura dos 4 estágios
  - Alinhamento com Tabela 7
  - Comparação v1.0 vs v2.0
  - Análise de cobertura LGPD/GDPR

- **README.md** - Guia Rápido (4 KB)
  - Resumo executivo
  - Mudanças principais
  - Status e alinhamento

- **EXEMPLO_VISUAL_v1_vs_v2.md** - Comparação (20 KB)
  - Diagramas ASCII dos 4 estágios
  - Lado a lado v1.0 vs v2.0
  - Objetivos de cada pergunta

- **ÍNDICE_COMPLETO.md** - Mapa (8 KB)
  - Navegação por objetivo
  - Mapa de referência cruzada
  - Troubleshooting e FAQ

- **relatorio_logs_2026_07_02.md** - Histórico (6 KB)
  - Análise do v1.0 (referência)
  - Distribuição de personas
  - Consistência das perguntas

### Dados (55 arquivos JSON)
- **logs/2026-07-02-v2.0/**
  - 55 arquivos JSON (~420 KB)
  - 13 perguntas por arquivo (4-3-3-3)
  - Versão: 2.0-novo
  - Personas: A01-A05 (5), P01-P50 (50)

## 🔧 Integração com Código

### 1. Atualizar Leitor de Perguntas

**Antes (v1.0):**
```python
# Esperava 10 perguntas
questions_count = 10
for stage in data['estagios']:
    for question in stage['perguntas']:
        # Processa...
```

**Depois (v2.0):**
```python
# Suporta 13 perguntas
questions_count = len([q for s in data['estagios'] 
                       for q in s['perguntas']])
for stage in data['estagios']:
    for question in stage['perguntas']:
        # Processa... (compatível com v1.0)
```

### 2. Validação JSON

```python
import json

# Carregar um log v2.0
with open('logs/2026-07-02-v2.0/A01_sessao_01.json') as f:
    data = json.load(f)

# Verificar versão
version = data['meta']['versao_questionnaire']
assert version == '2.0-novo', f"Expected v2.0, got {version}"

# Verificar estrutura
assert len(data['estagios']) == 4, "Deve ter 4 estágios"
assert sum(len(s['perguntas']) for s in data['estagios']) == 13

print("✅ Validação OK")
```

### 3. Migração de Dados

```python
# Função para converter v1.0 → v2.0
def migrate_questionnaire():
    import glob
    
    # Ler todos v2.0
    v2_files = glob.glob('logs/2026-07-02-v2.0/*.json')
    
    for file_path in v2_files:
        with open(file_path) as f:
            data = json.load(f)
        
        # Processar conforme necessário
        # ...
        
        print(f"✅ {file_path} processado")

migrate_questionnaire()
```

## 📊 Mudanças Principais

### Quantitativas
- **Perguntas**: 10 → 13 (+30%)
- **E2**: 2 → 3 (+50%)
- **E3**: 2 → 3 (+50%)
- **E4**: 2 → 3 (+50%)

### Qualitativas
- **Abordagem**: Prescritiva → Descritiva
- **Alinhamento**: ~60% → 100% com Tabela 7
- **Cobertura**: 8/9 → 9/9 critérios LGPD/GDPR

### Novos Tópicos
- E2: Segurança em armazenamento
- E3: Dependências técnicas
- E4: Políticas documentadas
- E4: Frequência de auditorias

## ✅ Checklist de Integração

- [ ] Clonar branch `feature/framework-v2.0`
- [ ] Ler `docs/framework-v2.0/README.md`
- [ ] Ler `docs/framework-v2.0/NOVO_FRAMEWORK_v2.0.md`
- [ ] Atualizar código que lê perguntas
- [ ] Validar arquivos JSON v2.0
- [ ] Testar com alguns arquivos (A01, P01)
- [ ] Processar todos 55 arquivos
- [ ] Atualizar documentação da plataforma
- [ ] Testar integração end-to-end
- [ ] Fazer merge para `main`

## 🚀 Implantação

### Opção 1: Merge Direto
```bash
git checkout main
git merge feature/framework-v2.0
git push origin main
```

### Opção 2: Pull Request
```bash
# No GitHub
1. Crie um Pull Request
2. Revise as mudanças
3. Faça merge quando aprovado
```

### Opção 3: Cherry-pick Commits
```bash
git checkout main
git cherry-pick feature/framework-v2.0
git push origin main
```

## 📌 Compatibilidade

### Estrutura JSON
- ✅ **100% compatível** com v1.0
- Mesma estrutura de metadados
- Mesma estrutura de estágios
- Versão marcada em `meta.versao_questionnaire`

### Código
- ⚠️ Código que itera sobre exatamente 10 perguntas falha
- ✅ Código genérico funciona sem modificação
- ✅ Código que usa `len()` para contar funciona

## 🆘 Troubleshooting

### "Faltam perguntas"
**Problema**: Código espera 10 perguntas, recebe 13  
**Solução**: Use `len()` para contar ou atualize constantes

### "Arquivo não encontrado"
**Problema**: Ainda está apontando para `logs/2026-07-02/`  
**Solução**: Use `logs/2026-07-02-v2.0/` para v2.0

### "Versão inválida"
**Problema**: Metadados mostram versão diferente  
**Solução**: Verifique `meta.versao_questionnaire == '2.0-novo'`

## 📞 Suporte

Para dúvidas sobre a integração:
1. Consulte `docs/framework-v2.0/ÍNDICE_COMPLETO.md`
2. Revise `docs/framework-v2.0/NOVO_FRAMEWORK_v2.0.md`
3. Verifique `CHANGELOG_v2.0.md` para histórico

## 📝 Notas Finais

- v2.0 está pronto para produção
- Totalmente alinhado com Tabela 7 da dissertação
- Compatível com estrutura JSON de v1.0
- Recomenda-se usar v2.0 para novas funcionalidades
- v1.0 pode ser mantido para compatibilidade retroativa

---

**Versão**: 2.0-novo  
**Data**: 2026-07-02  
**Branch**: feature/framework-v2.0  
**Status**: ✅ Pronto para integração
