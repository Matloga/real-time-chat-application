# Real-Time Chat Application

A full-stack, real-time chat app built with **React**, **Express**, **Socket.IO** and
**SQL Server** (via Prisma), with JWT authentication.

> **Note on the stack.** The original project brief specifies MongoDB with Mongoose.
> This implementation uses **Microsoft SQL Server** with Prisma instead, so Mongoose
> schemas and `$query`-style queries are replaced by a relational schema and
> Prisma's query builder. The layers above the database — REST routes, Socket.IO
> events, JWT auth, the React client — are unaffected by that substitution.

---

## What works right now

This is a working **vertical slice**, not the finished brief:

- Register / log in / log out, JWT in `localStorage`, bcrypt password hashing
- List users and start a direct (1:1) conversation
- Real-time message delivery over Socket.IO, persisted to SQL Server
- Conversation list with last-message preview and unread counts
- Online / offline presence dots
- History loads from the database, so conversations survive a refresh
- Optimistic sending with retry-safe duplicate suppression
- Responsive layout, sidebar stacks above the conversation under 768px

Deliberately **not** built yet (the remaining ✅ items in the brief): group chats,
typing indicators, file/image sharing, browser push notifications, and deployment.

### Status

Work in progress. The Prisma schema validates, every server module loads, and the
React client builds — but **the app has not yet been run end to end**, because it
still needs SQL Server installed locally. Steps 1–4 below have not been executed
on the machine this was written on. Treat it as a vertical slice to finish, not a
finished demo.

---

## Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 25.2.1 | 18+ works |
| SQL Server | 2022 Express (2025 also fine) | Free, 10 GB per database |
| SQL Server Express installer | — | Already downloaded to `C:\SQL2025\SQLEXPR_x64_ENU.exe` |

## Setup

### 1. Install SQL Server Express

Double-click `C:\SQL2025\SQLEXPR_x64_ENU.exe` and accept the licence, or run it
unattended from an **Administrator** PowerShell:

```powershell
& "C:\SQL2025\SQLEXPR_x64_ENU.exe" /ACTION=Install /FEATURES=SQLENGINE /INSTANCENAME=SQLEXPRESS /Q /IACCEPTSQLSERVERLICENSETERMS /SECURITYMODE=SQL /SAPWD="<strong-password>" /SQLSYSADMINACCOUNTS="<your-windows-user>" /TCPENABLED=1 /NPENABLED=0
```

This must be run with admin rights — it registers a Windows service.

### 2. Install dependencies

```powershell
cd server
npm install
npx prisma generate

cd ..\client
npm install
```

### 3. Configure environment files

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

In `server/.env`:

- `DATABASE_URL` — set the password to the one you chose for the app. Keep the
  `chatapp:` username and `chatapp` database; the setup script in the next step
  creates both.
- `JWT_SECRET` — generate one:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `SQL_ADMIN_URL` — uncomment and set to your `sa` password. Only needed for
  step 4, and can be deleted afterwards.

### 4. Create the database and tables

```powershell
cd server
node scripts/create-database.js   # creates the chatapp login + database
npx prisma migrate dev --name init  # creates the tables
```

### 5. Run both servers

```powershell
cd server
npm run dev     # http://localhost:5000

# in a second terminal
cd client
npm run dev     # http://localhost:5173
```

Open two different browser profiles (or one normal + one private window) and
register two accounts to see messages flow between them.

---

## Project layout

```
chat-app/
├── client/
│   ├── src/
│   │   ├── components/     Avatar, ConversationList, MessageList,
│   │   │                  MessageInput, NewChatPanel
│   │   ├── context/        AuthContext - session state
│   │   ├── pages/          AuthForm, ChatPage
│   │   ├── services/       api.js (REST), socket.js (Socket.IO)
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── .env.example
├── server/
│   ├── prisma/schema.prisma
│   ├── config/             env.js, prisma.js
│   ├── controllers/        auth, conversation
│   ├── middleware/         auth.js - JWT verification
│   ├── models/             (reserved for the upcoming group-chat logic)
│   ├── routes/             auth, conversation, user
│   ├── services/           conversation.service.js
│   ├── socket/             index.js - Socket.IO wiring
│   ├── utils/              ApiError, asyncHandler, constants
│   ├── scripts/            create-database.js
│   ├── app.js
│   └── server.js
└── README.md
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account, returns a JWT |
| `POST` | `/api/auth/login` | Returns a JWT |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/users?search=` | List/search other users |
| `GET` | `/api/conversations` | Conversations + last message + unread count |
| `POST` | `/api/conversations/direct` | Get or create a 1:1 conversation |
| `GET` | `/api/conversations/:id/messages` | Message history (keyset paginated) |
| `POST` | `/api/conversations/:id/read` | Reset the unread count |
| `GET` | `/api/health` | Liveness check |

## Socket.IO events

| Direction | Event | Payload |
| --- | --- | --- |
| → server | `send_message` | `{ conversationId, body, clientMessageId }` + ack callback |
| → server | `join_conversation` | `{ conversationId }` |
| → server | `mark_read` | `{ conversationId }` |
| ← client | `message_received` | Full message with sender |
| ← client | `user_online` / `user_offline` | `{ userId, lastSeenAt }` |

## Design decisions worth explaining

**Duplicate messages.** Every message carries a client-generated
`clientMessageId`, and the database has a unique constraint on
`(conversationId, clientMessageId)`. If a client retries a send, the insert hits
that constraint and the server returns the *existing* row instead of writing a
second one. The React client renders optimistically and then reconciles on the
server's ack, keyed on the same id.

**One chat per pair.** `conversations.directKey` stores the two user ids sorted
and joined, with a unique index on it. Two people cannot end up with two
separate 1:1 conversations, even under concurrent requests — the index, not the
application code, is what guarantees it.

**Unread counts without N+1 queries.** Each membership stores `lastReadAt`. The
conversation list reads every message newer than the *oldest* `lastReadAt` in one
query, then buckets them in memory against each conversation's own timestamp —
two round trips regardless of how many conversations you have.

**Presence with multiple devices.** `userId -> Set<socketId>` rather than a
single socket id, so closing a laptop does not mark you offline while your phone
is still connected.

**Authorisation on every write.** A socket is authenticated during the Socket.IO
handshake, and `assertMember` is called before any message is inserted — the
client is never trusted to decide whether it may write to a conversation.

## Next steps

Group chats (the schema already supports them), typing indicators, file uploads
with `multer`, and deployment. For deployment, note that SQL Server Express is
local-only: use Azure SQL or SQL Server in a container for the backend, and
switch `encrypt=true;trustServerCertificate=false` in `DATABASE_URL` for the
managed instance.
