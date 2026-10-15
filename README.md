# React Bank API (demo)

This Express API stores its demo data in MongoDB. It is a learning/demo backend, not production banking software. Deposits and transfers are simulated and do not move real funds.

## Start it

1. In this folder, run `npm install`.
2. Put `MONGODB_URI` and a `JWT_SECRET` of at least 32 characters in your existing `.env` file. The server loads this file locally with `dotenv`.
3. Run `npm run dev`.
4. The API listens on `http://localhost:5000`; check `/api/health`.

The frontend reads `REACT_APP_API_URL` if set, otherwise it calls `http://localhost:5000/api`.

## Deploy to Render

This repository includes a Render Blueprint at `../render.yaml` configured to deploy this folder as a Node web service.

1. Push the repository to GitHub or GitLab.
2. In the Render dashboard, create a **Blueprint** and select the repository.
3. In the Render service's **Environment** settings, add the values from your local `.env` for `MONGODB_URI` and `JWT_SECRET`, and set `CLIENT_ORIGIN` to the deployed frontend's origin (for example, `https://your-frontend.example.com`, without a trailing slash). Render does not read your local `.env` file, so enter these values in Render without committing the file. In MongoDB Atlas, allow network access from Render so the service can connect.
4. Deploy the Blueprint. Render builds with `npm ci`, starts with `npm start`, and checks `/api/health`.
5. Set the frontend's `REACT_APP_API_URL` build environment variable to `https://<your-render-service>.onrender.com/api`, then rebuild and redeploy the frontend.

The API stores application state in MongoDB's `appState` collection, in the database named in `MONGODB_URI`. This demo is not suitable for real banking or personal data.

## Routes

- Public: `POST /api/register`, `POST /api/login`, `GET /api/health`
- Account: `GET /api/me`, `PATCH /api/account`
- Money demo: `GET /api/transactions`, `POST /api/transfers`, `POST /api/deposits`
- Everyday demo payments: `POST /api/bill-payments` for airtime, data, electricity, and TV
- Other: `GET/POST /api/cards`, `PATCH /api/cards/:id`, `GET/PATCH /api/settings`, `POST /api/support`

Authenticated routes require `Authorization: Bearer <token>`. Do not put real personal or banking details in this demo.
