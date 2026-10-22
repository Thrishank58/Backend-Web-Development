# Session-Based Authentication (Express & Prisma)

A production-grade, session-based authentication implementation using Express 5, Prisma ORM, and SQLite.

## Architectural Overview

- **Opaque Session Token**: The client receives only a cryptographically unpredictable session ID (`sid`) stored in an HTTP-only, signed cookie—never credentials, user records, or hashes.
- **Server-Side Session Store**: Maps opaque session IDs to `{ userId, expiresAt }` and evicts expired sessions during reads.
- **Centralized Cookie Policy**: Centralizes cookie attributes (`httpOnly: true`, `sameSite: 'lax'`, `secure: boolean`, `signed: true`, `path: '/'`) so login and logout configurations cannot drift.
- **Repository Pattern**: Prisma database queries are isolated inside `userRepository.js`.
- **Identity Allowlist Serializer**: Strips password hashes and internal database metadata, exposing only safe fields (`id`, `name`, `email`).
- **Timing Attack Mitigation**: Uses asynchronous `bcrypt.compare` with constant-time dummy hashing when an email is not found to prevent user enumeration.

> [!NOTE]
> **In-Memory Store Disclaimer**: The supplied in-memory session store (`src/session/sessionStore.js`) is intended for learning and local development only. Because in-memory state cannot scale across multiple Node.js processes/containers and is lost upon server restarts, production deployments require a centralized, expiring store such as **Redis** or **Memcached**.

---

## Setup & Run Instructions

### 1. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL="file:./dev.db"
COOKIE_SECRET="replace-with-at-least-32-random-characters"
COOKIE_SECURE="false"
SESSION_TTL_MS="3600000"
PORT="3000"
```

*Note: Keep `COOKIE_SECURE="false"` for local HTTP testing. In production environments over HTTPS, set `COOKIE_SECURE="true"`.*

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize & Seed Database

Generate the Prisma Client, push the schema to SQLite, and seed the demo account:

```bash
npm run setup
```

Default seeded credentials:
- **Email:** `sam@example.com`
- **Password:** `SessionDemo!48`

### 4. Start the Server

```bash
# Start in watch mode
npm run dev

# Or start standard server
npm start
```

### 5. Run Automated Tests

Execute the comprehensive end-to-end test suite:

```bash
npm test
```

---

## API Reference

### 1. `POST /auth/login`
Authenticates credentials, generates an opaque session, and sets a signed `sid` cookie.

- **Request Body**:
  ```json
  {
    "email": "sam@example.com",
    "password": "SessionDemo!48"
  }
  ```
- **Success Response (`200 OK`)**:
  - **Headers**: `Set-Cookie: sid=s%3A...; Path=/; HttpOnly; SameSite=Lax`
  - **Body**:
    ```json
    {
      "id": 1,
      "name": "Sam",
      "email": "sam@example.com"
    }
    ```
- **Error Responses**:
  - `400 Bad Request`: Missing or non-string email/password.
  - `401 Unauthorized`: Generic error `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }` for unknown email or wrong password.

### 2. `GET /auth/me`
Protected identity endpoint that recovers identity from the verified server session.

- **Request Headers**: `Cookie: sid=s%3A...`
- **Success Response (`200 OK`)**:
  ```json
  {
    "id": 1,
    "name": "Sam",
    "email": "sam@example.com"
  }
  ```
- **Error Response (`401 Unauthorized`)**:
  - Returns `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` when cookie is missing, tampered, expired, or orphaned.

### 3. `POST /auth/logout`
Destroys the server-side session and clears the client cookie using matching options.

- **Success Response (`204 No Content`)**:
  - **Headers**: `Set-Cookie: sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
- **Idempotence**: Repeated calls still return `204 No Content`.

---

## Local Verification with `curl`

### Step 1: Successful Login
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sam@example.com","password":"SessionDemo!48"}' \
  -c cookies.txt
```
*Expected: `200 OK`, `Set-Cookie` with `sid`, `HttpOnly`, `SameSite=Lax`, and safe user JSON.*

### Step 2: Access Protected `/auth/me`
```bash
curl -i -X GET http://localhost:3000/auth/me \
  -b cookies.txt
```
*Expected: `200 OK` with `{ "id": 1, "name": "Sam", "email": "sam@example.com" }`.*

### Step 3: Access Without Cookie (or Tampered Cookie)
```bash
curl -i -X GET http://localhost:3000/auth/me
```
*Expected: `401 Unauthorized` with generic error JSON.*

### Step 4: Logout
```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```
*Expected: `204 No Content`, `Set-Cookie` expiring `sid`.*

### Step 5: Verify Revoked Session
```bash
curl -i -X GET http://localhost:3000/auth/me \
  -b cookies.txt
```
*Expected: `401 Unauthorized`.*

### Step 6: Verify Idempotent Logout
```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -b cookies.txt
```
*Expected: `204 No Content`.*
