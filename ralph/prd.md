# PRD: UI/Tutorial Improvements (Seed for Ralph Loop)

This PRD is intentionally split into small, verifiable checklist items so the Ralph loop can complete one item per iteration with clear review boundaries.

## 0. Prerequisite (Must Be Completed First)

- [ ] Prerequisite: Fix existing lint/typecheck/test failures so `./ralph/gates.sh` passes on a clean git tree from the repo root, and record the successful gate run in `ralph/progress.md`. Do not check any items in Sections A-C until this checkbox is complete.

## A. Module 1 Tutorial Improvements (Make It Easier to Follow)

All items below are blocked until the prerequisite checkbox above is complete.

- [ ] Identify the current Module 1 teaching tutorial step targets in `frontend/sgsl/app/onboarding/page.tsx` and introduce stable target hooks (refs and/or `data-*` attributes) needed for overlay highlighting without changing tutorial content.
- [ ] Add a reusable page-dimming overlay for the Module 1 teaching tutorial that visually greys out the page while the tutorial is active.
- [ ] Ensure the active tutorial target region remains visually highlighted (not greyed out) while the overlay is active for each step that references a page section.
- [ ] Ensure the tutorial box itself remains fully visible and layered above the dimmed overlay.
- [ ] Add step-level anchoring/positioning so the tutorial box is rendered near the target region it describes instead of a fixed distant position.
- [ ] Add viewport overflow handling for the anchored tutorial box (flip or clamp placement) so it stays on-screen at common desktop/tablet/mobile widths.
- [ ] Make overlay interaction accessible: `Escape` closes/dismisses the tutorial and the existing close control remains usable.
- [ ] Ensure the overlay does not trap keyboard navigation; `Tab`/`Shift+Tab` should still move focus in a reasonable order.
- [ ] Add reasonable focus management for tutorial open/close (focus moves to tutorial controls when opened and returns to the prior element when dismissed, when feasible).
- [ ] Verify and adjust Module 1 teaching tutorial behavior across common viewport sizes (mobile, tablet, desktop) so highlight alignment and tutorial placement remain usable.

## B. Add Similar Tutorials for Practice Lessons

- [ ] Extract or reuse shared tutorial overlay/anchoring behavior from the Module 1 teaching tutorial so practice tutorials can use the same interaction pattern without duplicating large blocks of code.
- [ ] Add a Module 1 practice tutorial entry point (trigger state and start/close flow) on the relevant Module 1 practice lesson page(s).
- [ ] Define and render Module 1 practice tutorial steps using the same overlay/highlight/anchoring behavior as the Module 1 teaching tutorial.
- [ ] Ensure Module 1 practice tutorial accessibility and responsive behavior match the Module 1 teaching tutorial baseline (escape/close, keyboard navigation, focus behavior, viewport checks).
- [ ] Add a Module 2 practice tutorial entry point (trigger state and start/close flow) on the relevant Module 2 practice lesson page(s).
- [ ] Define and render Module 2 practice tutorial steps using the same overlay/highlight/anchoring behavior as the Module 1 teaching tutorial.
- [ ] Ensure Module 2 practice tutorial accessibility and responsive behavior match the Module 1 teaching tutorial baseline (escape/close, keyboard navigation, focus behavior, viewport checks).

## C. Clear Completion / Next-Step Guidance

- [ ] Identify the existing completion/next-activity logic used by current practice/lesson/activity flows and document the integration points in code comments or local helper usage (without changing completion semantics).
- [ ] Add a reusable completion callout UI pattern (or localized component) that displays a clear “You’re done” message and action buttons.
- [ ] Show the completion callout when a user finishes the Module 1 practice/lesson/activity in scope, with buttons for “Proceed to next activity” and “Repeat this practice”.
- [ ] Wire “Repeat this practice” so it resets/restarts only the current practice flow without regressing stored completion tracking.
- [ ] Wire “Proceed to next activity” to compute the correct next activity using existing completion logic (do not hardcode a sequence that conflicts with current tracking).
- [ ] Show the same completion callout pattern for the Module 2 practice/lesson/activity in scope with the same two actions.
- [ ] Verify existing completion tracking still records progress correctly after adding the callouts and navigation actions (no regression in completion persistence/state updates).
