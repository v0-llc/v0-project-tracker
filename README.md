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

## Views

- **Board** — editable stage columns, drag-and-drop project cards, budget / hours / rate on each card
- **Hours** — month grid with projects as columns and dates as rows; every cell is editable
