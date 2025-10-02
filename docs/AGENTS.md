# Repository Guidelines

## Project Structure & Module Organization
The repository ahora separa responsabilidades por carpeta. `frontend/index.html` es la interfaz principal que consulta el endpoint de Apps Script, mientras que `frontend/legacy/index2.html` conserva una versión heredada. Los recursos estáticos (`faq.png`, `favicon.ico`) residen en `frontend/assets/` para acompañar a la página. El código de servidor vive en `backend/code.js`, sincronizado con el proyecto de Apps Script mediante `clasp`. Documentación y guías de contribución se guardan en `docs/`.

## Build, Test, and Development Commands
- `cd frontend && python3 -m http.server 8080` — serves the static site locally so you can exercise search, category filters, and AI interactions without deploying.
- `clasp push` and `clasp pull` — sync `code.gs` with the bound Apps Script project after local edits. Always pull before pushing to avoid overwriting collaborators.

## Coding Style & Naming Conventions
Follow the existing two-space indentation in HTML, inline JavaScript, and CSS blocks. Keep Tailwind utility classes declarative and grouped by purpose (layout, color, state). JavaScript identifiers use `camelCase`; data helpers in `code.gs` mirror spreadsheet headers using lowercase with diacritics removed. When adding styles, prefer extending the inline `<style>` block instead of scattering new CSS files.

## Testing Guidelines
There is no automated test suite yet. Verify front-end behaviour manually across light/dark themes and for both tabs. Confirm that new spreadsheet fields flow through `renderFaqs` and helper functions without breaking highlighting. For backend changes, use the Apps Script execution log and sample POST payloads from the browser console or `curl` to exercise `addData`, `updateData`, and `manageCategories` actions.

## Commit & Pull Request Guidelines
Commits in this repo are short and descriptive (e.g., “Update index.html”). Keep messages under 72 characters, written in the imperative mood, and scope them to a single concern. Pull requests should include: a concise summary of user-facing changes, any relevant screenshots or GIFs of UI updates, links to spreadsheet or script IDs touched, and manual test notes covering both the static page and the Apps Script endpoint.

## Security & Deployment Notes
Do not commit API keys or spreadsheet URLs beyond the public constants already present. Refresh Apps Script web app deployments after backend changes and update `SCRIPT_URL` in `index.html` only once the new deployment URL is live.
