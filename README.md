🛡️ Plataforma LGPD – Análise de Conformidade e Riscos

Avalie a conformidade da sua organização com a Lei Geral de Proteção de Dados (LGPD) e identifique riscos com base na ISO/IEC 27001.

A plataforma utiliza questionários dinâmicos, análise automatizada com IA e dashboards interativos para apresentar o nível de maturidade e risco em segurança da informação.

🌐 Acesso Online

Versão publicada:
https://platform-lgpd-compliance.vercel.app/

⚙️ Principais Funcionalidades

Questionário Adaptativo
Perguntas inteligentes que se ajustam conforme o perfil e respostas do usuário.

Análise Automatizada
Cálculo de score de conformidade e geração de recomendações personalizadas.

Dashboard Interativo
Visualização com gráficos de:

Distribuição de riscos

Status de controles ISO/IEC 27001

Nível de maturidade organizacional

Exportação de Relatório
Relatório dinâmico com pontuação, riscos e recomendações.

Integração com Firebase
Armazenamento seguro em nuvem com autenticação e controle de acesso.

👥 Perfis de Acesso

MASTER

Gerencia administradores (criar, ativar, desativar, excluir)

Controle total da plataforma

Visão geral de todos os questionários e dados

ADMIN

Cria e gerencia questionários

Define contexto e público-alvo

Compartilha links de acesso

Acompanha respostas e resultados

USUÁRIO

Acessa o formulário via link

Visualiza introdução personalizada

Responde às perguntas

Envia respostas para análise

⚙️ Instalação Local

Siga os passos abaixo para executar a plataforma em ambiente local.

Clone o repositório

git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git

Acesse a pasta do projeto

cd PlatformLGPDCompliance

Instale as dependências

npm install

🔐 Configuração de Ambiente

Frontend (.env)

Crie um arquivo .env na raiz do projeto:

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

Backend (server/.env)

Crie o arquivo:

server/.env

Com o conteúdo:

GROQ_API_KEY=your_groq_api_key
PORT=8787

Firebase Admin

Adicione o arquivo de credencial:

server/serviceAccountKey.json

Este arquivo é sensível e não deve ser enviado ao GitHub.

▶️ Executar o Projeto

npm run dev

🌍 Acesso Local

Frontend: http://localhost:5173

Backend: http://localhost:8787

🧪 Como Testar

Fluxo recomendado

Login como ADMIN

Criar um questionário

Definir contexto e público-alvo

Gerar link de acesso

Acessar como USUÁRIO

Abrir o link do formulário

Responder as perguntas

Enviar respostas

Voltar como ADMIN

Visualizar análise gerada

Conferir dashboard

Validar score e recomendações

📦 Comandos Úteis

npm install → Instalar dependências
npm run dev → Rodar em desenvolvimento
npm run build → Gerar build de produção
npm run preview → Visualizar build

🧰 Tecnologias Utilizadas

React + Vite + TypeScript

Firebase (Auth + Firestore)

Tailwind CSS

shadcn/ui

Recharts

Framer Motion

Lucide Icons

Sonner

🎨 Design

Cores principais:

#1D4ED8

#153A95

#3B82F6

#1E6EE3

#4A4A4A

Fonte: Inter
Estilo: Minimalista, com degradês azulados e animações suaves

🚀 Deploy

Hospedado na Vercel:

https://platform-lgpd-compliance.vercel.app/

Deploy automático a cada push na branch main

🔒 Segurança

Variáveis sensíveis protegidas via .env

Firebase para autenticação segura

Estrutura preparada para boas práticas LGPD

🧠 Objetivo do Projeto

A plataforma foi desenvolvida com foco em:

Avaliação de maturidade em LGPD

Identificação de riscos em segurança da informação

Automação de análise com IA

Visualização estratégica de dados

👩‍💻 Autora

Ketrin Vargas
Engenheira de Software • Mestranda em Engenharia de Software
