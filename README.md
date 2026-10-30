# PhishGuard

PhishGuard is a responsive URL phishing-screening demo with a React interface, Express API, explainable rule-based analysis, optional Google Safe Browsing checks, and MySQL-backed scan history.

## Requirements

- Node.js 20 or newer
- MySQL 8 or compatible MariaDB server

## Local setup

1. Create a database and table by running `database/schema.sql` in MySQL. The API can also create the `scans` table on startup, but the database itself must already exist.
2. Copy `.env.example` to `.env` and set your MySQL connection values. The defaults are `phishguard`, `root`, and `root` for local development.
3. Optionally add a Google Safe Browsing API key as `GOOGLE_SAFE_BROWSING_API_KEY`. Keep it server-side. When enabled, submitted scan URLs are sent to Google's Safe Browsing endpoint for reputation checks.
4. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

5. Open `http://localhost:5173`. The API listens on `http://localhost:3001`.

For a production frontend build, run `npm run build`; then set `CLIENT_ORIGIN` to the frontend origin and run `npm start` for the API. Serve the generated `dist/` directory with a static web server configured to proxy `/api` requests to the API.

## API

- `GET /api/health` — API and MySQL readiness.
- `POST /api/scans` — analyzes and stores `{ "url": "https://example.com" }`.
- `GET /api/scans?search=example&risk=Low&limit=100` — filtered, newest-first scan history (maximum 200 records).
- `GET /api/dashboard` — aggregate counts and the last seven days of activity.

## Analysis and safety boundaries

The rule engine checks URL length, IP-address hosts, HTTP versus HTTPS scheme, sensitive-action keywords, nested subdomains, URL shorteners, uncommon extensions, Punycode, `@` symbols, and hyphens. Its weighted risk score is an explainable heuristic, not a machine-learning prediction or a safety certification.

The server **never fetches, resolves, redirects to, or opens the submitted URL**. It only parses the submitted text and, if configured, sends it to the fixed Google Safe Browsing API endpoint. HTTPS status means the URL specifies the HTTPS scheme; it does not mean that a TLS certificate was checked. A missing Safe Browsing match is not proof of safety.

Scanned URLs are stored in MySQL, including their paths and query strings. Do not submit URLs containing passwords, private tokens, or personal information. The application does not request or store website passwords.

## Tests

```sh
npm test
npm run build
```
