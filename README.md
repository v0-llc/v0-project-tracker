# Slate

A Vue 3 workspace for tracking freelance production: kanban stages, daily hours, budgets, and effective hourly rate.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with the Firebase web app config from **Project settings → Your apps**.

In the Firebase console:

1. Enable **Authentication → Google**.
2. Create a **Firestore** database.
3. Paste the contents of `firestore.rules` into the Firestore Rules tab (or run `npx firebase deploy --only firestore:rules`).

Those rules let a signed-in user read and write only `users/{theirUid}/**`.

```bash
npm run dev
```

Without Firebase keys, the login screen still lets you try the workspace locally. Local data stays in the browser until you connect Firebase.

The live site is [v0-project-tracker.web.app](https://v0-project-tracker.web.app). Pushes to `main` build the app and deploy Firebase Hosting via `.github/workflows/deploy-hosting.yml`. Add these repository secrets before the first deploy:

- `FIREBASE_SERVICE_ACCOUNT_V0_PROJECT_TRACKER` — JSON key for a service account with Firebase Hosting Admin, Firebase Authentication Admin, Cloud Run Viewer, and API Keys Viewer
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` — the same web config as `.env`

In Authentication, allow `v0-project-tracker.web.app` (and `v0-project-tracker.firebaseapp.com` if it is not already listed).

```bash
npx firebase deploy --only hosting
```

## Views

- **Board** — editable stage columns, drag-and-drop project cards, budget / hours / rate on each card
- **Hours** — month grid with projects as columns and dates as rows; every cell is editable
