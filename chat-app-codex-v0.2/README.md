# Chat App

Mensageiro estilo WhatsApp/Telegram sem número de telefone. A conta usa somente username e senha.

## Stack

- Frontend: Next.js + React + TypeScript
- Backend: NestJS + Socket.IO + JWT
- Banco: PostgreSQL + Prisma
- Monorepo: npm workspaces

## Estrutura

```text
apps/
  web/   # interface Next.js
  api/   # API NestJS + WebSocket
packages/
  types/ # espaço reservado para tipos compartilhados
```

## Pré-requisitos

- Node.js 20+
- Docker Desktop

## Rodar

```bash
npm install
docker compose up -d
```

Copie `apps/api/.env.example` para `apps/api/.env` e mantenha uma senha JWT forte fora do controle de versão.

Depois:

```bash
npm run db:generate
npm run db:migrate
npm run dev:api
npm run dev:web
```

Web: http://localhost:3000  
API: http://localhost:3001

## Funcionalidades já implementadas

- cadastro com username, nome e senha;
- login com JWT;
- hash de senha com bcrypt;
- busca de usuários por username;
- conversa privada com chave única para os dois participantes;
- histórico de mensagens;
- envio e recebimento em tempo real via Socket.IO;
- autenticação do WebSocket por JWT;
- autorização para entrar em salas de conversa;
- indicador "digitando...";
- presença básica/lastSeen;
- PostgreSQL com Prisma.
