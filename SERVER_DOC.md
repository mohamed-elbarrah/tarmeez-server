Tarmeez Server — Developer Documentation

Overview
- Stack: NestJS (Node 18+/ESM), Prisma (Postgres), Passport + JWT for auth, bcryptjs for hashing.
- Purpose: Implements platform, merchant and customer authentication, merchant/store models, and basic API scaffolding under `/api`.


Demo credentials (use only for testing)
Superadmin -> superadmin@example.com / Password123!
Merchant    -> merchant@example.com / Password123!  storeSlug: demo-store
Customer    -> customer@example.com / Password123!  storeSlug: demo-store

Repository layout (important files/folders)
- `src/` — application source
  - `main.ts` — bootstrap, global prefix (`api`), cookie parser, CORS and global pipes
  - `app.module.ts` — root Nest module
  - `app.controller.ts` — root `/api` GET route
  - `auth/` — authentication module
    - `auth.controller.ts` — endpoints under `/api/auth`
    - `auth.service.ts` — core logic: register, login, token generation, refresh, logout, cookie helpers
    - `dto/` — request DTOs (platform-login, merchant-register, customer-login, customer-register)
    - `guards/` — `JwtAuthGuard`, `JwtRefreshGuard`
    - `strategies/` — `jwt-access.strategy.ts`, `jwt-refresh.strategy.ts` (read tokens from cookies)
    - `decorators/` — `CurrentUser` decorator, roles decorator
  - `prisma/` — Prisma module + service
- `prisma/schema.prisma` — database schema (User, Merchant, Store, Customer, enums)
- `postman/` — generated Postman collection & environment JSON

Endpoints (summary)
- GET `/api/` — health/hello
- POST `/api/auth/platform/register` — create merchant and user (merchant status default PENDING)
  - Body: see `src/auth/dto/merchant-register.dto.ts`
- POST `/api/auth/platform/login` — platform login (merchant/admin)
  - Body: `email`, `password`
  - Returns: sets cookies `access_token` and `refresh_token` (HTTP-only)
- POST `/api/auth/customer/register` — register customer for a store
  - Body: see `src/auth/dto/customer-register.dto.ts`
- POST `/api/auth/customer/login` — customer login (requires `storeSlug`)
  - Body: `email`, `password`, `storeSlug`
- POST `/api/auth/refresh` — issues new tokens (expects refresh cookie)
- POST `/api/auth/logout` — clears server-side refresh token and cookies
- GET `/api/auth/me` — returns current user (requires access cookie)

Auth details
- Passwords: hashed with `bcrypt.hash(password, 10)` before storage; verified with `bcrypt.compare()` on login.
- Tokens: both access and refresh JWTs are generated using `JwtService.signAsync()` with secrets from env:`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and expirations from `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
- Refresh token storage: server stores a hashed refresh token in `User.refreshToken` (bcrypt-hashed). The raw refresh token is sent to client in cookie and compared via `bcrypt.compare()` during `refreshTokens()`.
- Cookies: `setTokenCookies()` sets two cookies: `access_token` and `refresh_token`. Currently they are HTTP-only and `secure` is set in code — for local development you may want to change `secure` to `process.env.NODE_ENV === 'production'` so cookies work over HTTP.
- Strategies: `JwtAccessStrategy` extracts access token from `request.cookies.access_token`. `JwtRefreshStrategy` extracts refresh token and returns it in `validate()` payload.

Environment variables (`server/.env`)
- `DATABASE_URL` — Postgres connection string (e.g. `postgresql://user:pass@localhost:5432/platform_db`)
- `JWT_ACCESS_SECRET` — secret for access tokens
- `JWT_REFRESH_SECRET` — secret for refresh tokens
- `JWT_ACCESS_EXPIRES_IN` — access token TTL (e.g. `1m`, `15m`)
- `JWT_REFRESH_EXPIRES_IN` — refresh token TTL (e.g. `7d`)
- `CLIENT_URL` — used for CORS origin
- `PORT` — optional port (defaults to `8000`)

Running locally
1. Ensure Postgres is running and `DATABASE_URL` points to it.
2. From `server/`:
```powershell
npm install
npm run start:dev
```
3. Server starts on `http://localhost:8000` by default and exposes API under `/api`.

Database / Prisma
- Schema: `prisma/schema.prisma` (see models `User`, `Merchant`, `Store`, `Customer`).
- Generate client / run migrations (if using migrations):
```bash
npx prisma generate
npx prisma migrate dev --name init
```
- To inspect DB: `npx prisma studio`

Postman collection (import)
- Path: `postman/Tarmeez.postman_collection.json`
- Environment: `postman/Tarmeez.postman_environment.json` (contains `base_url` = `http://localhost:8000`)
- Import both into Postman, select the environment, and run requests in order:
  1. Platform - Register (optional)
  2. Platform - Login (sets cookies)
  3. Auth - Me
  4. Auth - Refresh
  5. Auth - Logout

Notes and troubleshooting
- ECONNREFUSED in Postman: means server is not running or listening on host/port. Start server and verify with `curl http://localhost:8000/api/`.
- Cookies not stored/sent during testing: check `secure` flag and scheme (HTTP vs HTTPS) and domain/port. Postman’s cookie jar stores cookies per host:port.
- If you receive Prisma errors on startup, confirm `DATABASE_URL` and that the DB exists. Run migrations or adjust schema as needed.

Developer tips
- To allow merchants with `PENDING` status to login during development, auth check in `src/auth/auth.service.ts` was relaxed (REJECTED still blocked).
- For production, revert any dev relaxations and ensure `secure: true` for cookies and `CLIENT_URL` is correct.
- Keep JWT secrets in a secure vault for production.

Testing
- Unit tests: `npm run test`
- E2E: `npm run test:e2e`
- You can run Postman collections via Newman:
```bash
npm i -g newman
newman run postman/Tarmeez.postman_collection.json -e postman/Tarmeez.postman_environment.json
```

If you'd like
- I can move this file to `README.md` (replacing the stock Nest README) and remove debug logs from `src/main.ts`.
- I can add automated Postman tests (assert `set-cookie` headers, status codes) to the collection.

Contact
- For questions about specific code paths, open the file and reference the symbol (e.g., `src/auth/auth.service.ts`).
