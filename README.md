🛡️ Plataforma LGPD – Análise de Conformidade e Riscos

Avalie a conformidade da sua organização com a Lei Geral de Proteção de Dados (LGPD) e identifique riscos com base na ISO/IEC 27001.
A plataforma utiliza questionários dinâmicos, análise automatizada e dashboards interativos para exibir o nível de maturidade e risco em segurança da informação.

🌐 Acesso Online
Versão publicada: https://lgpd-compliance.vercel.app/

Principais Funcionalidades
- Questionário Adaptativo: perguntas inteligentes que se ajustam conforme o perfil e respostas do usuário.
- Análise Automatizada: cálculo de score de conformidade e geração de recomendações personalizadas.
- Dashboard Interativo: gráficos com distribuição de riscos, status de controles ISO/IEC 27001 e nível de maturidade.
- Exportação de Relatório: relatório dinâmico com pontuação e recomendações.
- Integração com Firebase: armazenamento seguro e criptografia em nuvem.

⚙️ Instalação Local
1. Clone o repositório:
   git clone https://github.com/KetrinDiovanaVargas/lgpd-compliance-platform.git
2. Acesse o diretório:
   cd lgpd-compliance-platform
3. Instale as dependências:
   npm install
4. Crie o arquivo .env na raiz do projeto e adicione as credenciais Firebase:
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
5. Execute o projeto localmente:
   npm run dev

📦 Comandos Úteis
- npm install → Instala dependências
- npm run dev → Executa em modo desenvolvimento
- npm run build → Gera versão de produção
- npm run preview → Pré-visualiza o build

🧰 Principais Dependências
React + Vite, Firebase, Tailwind CSS, shadcn/ui, lucide-react, Recharts, Sonner, Framer Motion

🎨 Design
Cores principais: #1D4ED8, #153A95, #3B82F6, #1E6EE3, #4A4A4A
Fonte: Inter
Estilo: Minimalista, com degradês azulados e animações suaves.

🚀 Deploy Automático com Vercel
Hospedado no Vercel: https://lgpd-compliance.vercel.app/
Cada push para main gera um novo deploy automaticamente.

🧠 Foco em privacidade, design e segurança da informação.
