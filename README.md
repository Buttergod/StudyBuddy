# StudyBuddy

StudyBuddy is a responsive study workspace built with React, TypeScript, and Vite. It brings a daily plan, focus timer, editable notes, course-specific flashcard decks, a Schoology calendar, and progress tracking into five tabs.

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
- `npm test` runs import and calendar parser tests.

## Study tools

- **Today**: add, complete, edit, and reorder a daily task list.
- **Focus room**: start, pause, and reset 25-minute, 50-minute, or short-break timers.
- **Notes**: search, edit, and autosave notes in this browser.
- **Flashcards**: create class decks, import course files, reveal answers, mark recall, and navigate by keyboard or touch.
- **School calendar**: import Schoology calendar `.ics` files and browse due dates by month.
- **Progress**: view focus time and task completion, then export a JSON backup.

The course picker is set up for Biology I Honors, AP Environmental Science, World History & Geography II Honors, English 9 Honors, AP Computer Science Principles, Algebra II Honors, Spanish III, and Wildcat Connection.

The study importer accepts PDF, DOCX, PPTX, XLSX/XLSM, CSV/TSV, TXT, Markdown, HTML, JSON, and JavaScript lesson data. It creates one deck per file, and one deck per lesson for `lesson_data` objects. CSV and text imports work best with term/definition pairs; imported decks can be reviewed and edited before studying. Images, scans without selectable text, audio, and video need OCR or transcription support and are not parsed yet.

To bring in Schoology dates, export/download a calendar `.ics` file from Schoology and choose **Import .ics** in Today. This is a local file import, not a direct Schoology sign-in. Do not paste your Schoology password into StudyBuddy; a direct account connection would require a school-approved integration and credentials.

Use `Ctrl+K` (or `⌘K` on macOS) to open quick navigation and actions. The theme toggle, browser notification permission, keyboard focus states, and reduced-motion preference are supported. App data is stored locally in browser storage; exporting a backup is available from Progress.

## Project layout

- `src/App.tsx` contains the app shell, study views, and local study state.
- `src/App.css` contains responsive dashboard and interaction styles.
- `src/index.css` contains the shared theme tokens and base styles.
- `public/` contains static assets served by Vite.

Study plans, imported files, decks, and calendar events are stored in this browser. The app does not upload class materials or connect to a Schoology account directly.
