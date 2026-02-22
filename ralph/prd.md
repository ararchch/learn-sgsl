# PRD: UI/Tutorial Improvements (Seed for Ralph Loop)

This PRD is intentionally split into verifiable checklist items so the Ralph loop can complete one item per iteration with clear review boundaries.

## 0. Prerequisite (Must Be Completed First)

- [x] Prerequisite: Fix existing lint/typecheck/test failures so `./ralph/gates.sh` passes on a clean git tree from the repo root, and record the successful gate run in `ralph/progress.md`. Do not check any items in Sections A-C until this checkbox is complete.

## A. Module 1 Tutorial Improvements (Make It Easier to Follow)

All items below are blocked until the prerequisite checkbox above is complete.

- [x] Identify the current Module 1 teaching tutorial step targets in `frontend/sgsl/app/onboarding/page.tsx` and introduce stable target hooks (refs and/or `data-*` attributes) needed for overlay highlighting without changing tutorial content.
- [x] Add a reusable page-dimming overlay for the Module 1 teaching tutorial that visually greys out the page while the tutorial is active.
- [ ] **Guided tutorial overlay v1 (spotlight + layering):** When the tutorial is active, dim the page **but keep the active step’s target region “spotlit” (not dimmed)** for steps that reference a page section, and ensure the **tutorial box remains fully visible and clickable above** the overlay.
- [ ] **Anchored tutorial box + viewport safety:** Render the tutorial box **near its target** (per-step anchoring) and add **overflow handling** (flip/clamp) so the box stays on-screen across common mobile/tablet/desktop widths.
- [ ] **Keyboard + focus accessibility baseline:** `Escape` dismisses the tutorial; overlay does not trap focus (`Tab`/`Shift+Tab` still works); add reasonable focus management (focus moves to tutorial controls when opened and returns to prior element on close when feasible).
- [ ] **Responsive verification pass:** Verify and adjust highlight alignment + anchored placement across common viewport sizes (mobile/tablet/desktop) so the tutorial remains usable.

## B. Add Similar Tutorials for Practice Lessons

- [ ] **Shared tutorial engine extraction:** Extract/reuse the overlay/spotlight/anchoring/accessibility behavior from Module 1 teaching tutorial so practice tutorials can use the same pattern without duplicating large blocks of code.
- [ ] **Module 1 practice tutorial (end-to-end):** Add entry point (trigger + start/close flow), define/render steps using the shared engine, and ensure accessibility + responsive behavior match the teaching tutorial baseline.
- [ ] **Module 2 practice tutorial (end-to-end):** Add entry point (trigger + start/close flow), define/render steps using the shared engine, and ensure accessibility + responsive behavior match the teaching tutorial baseline.

## C. Clear Completion / Next-Step Guidance

- [ ] **Document completion integration points:** Identify existing completion/next-activity logic used by current practice/lesson/activity flows and document integration points in code comments or local helper usage (without changing completion semantics).
- [ ] **Completion callout UI + Module 1 wiring:** Add a reusable completion callout UI pattern and show it when a user finishes Module 1 practice/lesson/activity in scope, with “Proceed to next activity” + “Repeat this practice”.
- [ ] **Completion actions correctness (Module 1):** Wire “Repeat this practice” to restart only the current flow without regressing stored completion; wire “Proceed to next activity” to compute the next activity using existing completion logic (no hardcoded conflicting sequences).
- [ ] **Completion callout + actions for Module 2:** Show the same callout for Module 2 in-scope activity and wire the same two actions using existing completion logic.
- [ ] **Regression verification:** Verify existing completion tracking still records progress correctly after adding callouts and navigation actions (no regression in completion persistence/state updates).