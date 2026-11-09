# Authentication Fundamentals

Authentication endpoints implemented with Express, Prisma, and bcryptjs.

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm start
```

The SQLite datasource keeps local setup self-contained. Do not commit `.env` or `prisma/dev.db`.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`

### Registration (`POST /auth/register`)
- **Body**: `{ "name": "Sam", "email": "sam@example.com", "password": "correct horse battery staple" }`
- **Success (201)**: Returns `{ "id": 1, "name": "Sam", "email": "sam@example.com" }`
- **Duplicate (409)**: Returns `{ "error": { "code": "EMAIL_ALREADY_EXISTS", "message": "Email already registered" } }`
- **Validation error (400)**: Missing or invalid fields.

### Login (`POST /auth/login`)
- **Body**: `{ "email": "sam@example.com", "password": "correct horse battery staple" }`
- **Success (200)**: Returns `{ "id": 1, "name": "Sam", "email": "sam@example.com" }`
- **Invalid credentials (401)**: Returns `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }` for both unknown email and incorrect password.
- **Validation error (400)**: Missing or invalid fields.
