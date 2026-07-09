# Sistema de Feedback - Guia de Configuração

## 📋 Visão Geral

O sistema de feedback coleta respostas de usuários após a conclusão de cada avaliação LGPD usando uma escala Likert de 4 pontos.

## 🗂️ Estrutura de Dados

### Coleção: `feedback`

Cada documento de feedback contém:

```json
{
  "assessmentId": "string",           // ID da avaliação respondida
  "assessmentTitle": "string",        // Título da avaliação
  "responses": [                       // Array com 10 respostas
    {
      "questionId": 1,
      "answer": 4                      // 1=Discordo Completamente, 4=Concordo Plenamente
    },
    // ... 10 respostas
  ],
  "timestamp": "server-timestamp",    // Data/hora do servidor
  "userAgent": "string"               // User agent do navegador (analytics)
}
```

## 📊 Categorias de Perguntas

### 1. Utilidade Percebida (4 perguntas)
- **Q1**: Ferramenta ajudou a refletir sobre maturidade
- **Q2**: Perguntas foram relevantes para identificar gaps
- **Q3**: Ferramenta pode melhorar processos LGPD/privacidade
- **Q4**: Diagnóstico foi útil para entender maturidade

### 2. Facilidade de Uso (4 perguntas)
- **Q5**: Fácil entender como responder
- **Q6**: Sequência de perguntas foi clara e coerente
- **Q7**: Interação exigiu pouco esforço
- **Q8**: Linguagem foi compreensível

### 3. Atitude em Relação ao Uso (1 pergunta)
- **Q9**: Experiência geral foi positiva

### 4. Intenção de Uso (1 pergunta)
- **Q10**: Utilizaria novamente a ferramenta

## 🔒 Regras de Segurança Firestore

As regras já estão configuradas em `firestore.rules`:

```
match /feedback/{feedbackId} {
  // Anyone can submit feedback
  allow create: if true;

  // Only authenticated admins can read/update/delete
  allow read, update, delete: if request.auth != null &&
                                 request.auth.token.admin == true;
}
```

## 🚀 Deployment

### 1. Ativar Regras no Firebase Console

```bash
# Login no Firebase
firebase login

# Deploy das regras
firebase deploy --only firestore:rules
```

### 2. Verificar Regras

1. Acesse Firebase Console
2. Firestore Database → Rules
3. Copie/Paste conteúdo de `firestore.rules`
4. Clique "Publish"

### 3. Criar Índice (se necessário)

Para queries de admin dashboard (leitura de feedback):

```
Collection: feedback
Fields: assessmentId (Ascending), timestamp (Descending)
Query scope: Collection
```

## 📈 Visualizar Feedback (Admin)

No admin dashboard, adicione um endpoint para ler feedback:

```typescript
// GET /api/admin/feedback?assessmentId=...
const feedbackQuery = query(
  collection(db, 'feedback'),
  where('assessmentId', '==', assessmentId),
  orderBy('timestamp', 'desc')
);

const docs = await getDocs(feedbackQuery);
```

## 📱 Frontend Integration

### Button appears on DashboardScreen:
- Posicionado antes do botão "Nova Avaliação"
- Estilo: Gradiente vermelho/rosa com ícone de coração
- Responsivo para mobile e desktop

### Modal Features:
- Validação de campos (todas obrigatórias)
- Indicador de progresso visual
- Cores semânticas para escala Likert
- Mensagem de confirmação após envio

## ⚠️ Notas de Produção

### Segurança:
- [ ] Substituir catch-all rule com `allow read, write: if false;`
- [ ] Implementar autenticação de admin via custom claims
- [ ] Configurar CORS se houver backend adicional
- [ ] Implementar rate limiting para create (feedback)

### Analytics:
- [ ] Criar dashboard de feedback responses
- [ ] Configurar Cloud Functions para processar feedback
- [ ] Exporter dados para Google Sheets/Analytics

### Backup:
- [ ] Habilitar backup automático do Firestore
- [ ] Configurar retenção de dados (ex: 2 anos)

## 🧪 Teste Local

```bash
# 1. Iniciar emulator Firestore
firebase emulators:start --only firestore

# 2. Testar criar feedback
curl -X POST http://localhost:8080/... \
  -H "Content-Type: application/json" \
  -d '{
    "assessmentId": "test-123",
    "assessmentTitle": "Test Assessment",
    "responses": [{"questionId": 1, "answer": 4}],
    "timestamp": null,
    "userAgent": "Mozilla/5.0..."
  }'

# 3. Testar ler feedback (deve falhar sem admin token)
```

## 📞 Troubleshooting

### "Permission denied" ao criar feedback
- Verificar se Firestore está online
- Verificar regra `allow create: if true;`
- Verificar CORS e origin headers

### Feedback não aparece no Firestore Console
- Verificar se documento foi criado em `feedback` collection
- Verificar timestamps (pode estar em tempo de servidor)
- Verificar Network tab do browser para errors

### Admin não consegue ler feedback
- Verificar se user tem `admin` custom claim
- Ir a Firebase Auth → User → Custom Claims
- Adicionar: `{ "admin": true }`

## 📚 Referências

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Likert Scale Best Practices](https://www.nngroup.com/articles/rating-scales/)
- [Feedback Survey Design](https://www.usertesting.com/blog/survey-design)
