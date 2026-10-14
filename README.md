# React Bank API (demo)

This Express API uses a local JSON file for persistence. It is a learning/demo backend, not production banking software. Deposits and transfers are simulated and do not move real funds.

## Start it

1. In this folder, run `npm install`.
2. Copy `.env.example` to `.env` and set `JWT_SECRET` to a random secret with at least 32 characters.
3. Run `npm run dev`.
4. The API listens on `http://localhost:5000`; check `/api/health`.

The frontend reads `REACT_APP_API_URL` if set, otherwise it calls `http://localhost:5000/api`.

## Routes

- Public: `POST /api/register`, `POST /api/login`, `GET /api/health`
- Account: `GET /api/me`, `PATCH /api/account`
- Money demo: `GET /api/transactions`, `POST /api/transfers`, `POST /api/deposits`
- Other: `GET/POST /api/cards`, `PATCH /api/cards/:id`, `GET/PATCH /api/settings`, `POST /api/support`

Authenticated routes require `Authorization: Bearer <token>`. Account data is stored in `data/db.json`; do not put real personal or banking details in this demo.
