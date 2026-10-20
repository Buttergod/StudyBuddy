# StudyBuddy

StudyBuddy is a responsive study workspace built with React, TypeScript, and Vite. It brings a daily plan, focus timer, editable notes, flashcards, and progress tracking into five tabs.

## Start here

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Vite prints the local URL when the development server starts.

## Scripts

- `npm run dev` starts the development server.
- `npm run build` runs the TypeScript project build and creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.
- `npm run lint` runs ESLint.

## Study tools

- **Today**: add, complete, edit, and reorder a daily task list.
- **Focus room**: start, pause, and reset 25-minute, 50-minute, or short-break timers.
- **Notes**: search, edit, and autosave notes in this browser.
- **Flashcards**: create cards, reveal answers, mark recall, and navigate by keyboard or touch.
- **Progress**: view focus time and task completion, then export a JSON backup.

Use `Ctrl+K` (or `⌘K` on macOS) to open quick navigation and actions. The theme toggle, browser notification permission, keyboard focus states, and reduced-motion preference are supported. App data is stored locally in browser storage; exporting a backup is available from Progress.

## Project layout

- `src/App.tsx` contains the app shell, study views, and local study state.
- `src/App.css` contains responsive dashboard and interaction styles.
- `src/index.css` contains the shared theme tokens and base styles.
- `public/` contains static assets served by Vite.

This starter has no server, account system, or cross-device synchronization. Browser notifications are local to an open browser session; shared presence, real-time collaboration, push delivery, and server-backed data need a backend before they can be provided honestly.
