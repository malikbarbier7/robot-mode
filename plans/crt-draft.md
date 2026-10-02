# Draft on the screen, commit on paper

Restore point: `8f7a6fb` on `machine-day` (pushed). `git reset --hard 8f7a6fb` brings it back.

## The idea

The CRT holds the **draft** week. It is the only place the week is edited, and
it re-solves live on every edit. **PRINT** copies the draft onto the paper.
After that the paper never changes until the next PRINT. **SAVE** sends the
paper to the real printer (or to a PDF). The paper is a record; the screen is a
workbench.

Rule: **everything that leaves the machine comes from the paper.** That covers
SAVE, EXPORT .ICS, today's ticket and the binder. If the screen has changes
that haven't been printed, the PRINT key is lit and the status line says so.

## Where things stand today

- `useRobotMode` solves one week (`rm.schedule`), and every printer renders it
  live. There is no notion of a printed copy.
- `page.tsx` switches `main` between `Boot`, `Setup`, `Generating`, and the
  three printers: `Printout` (list), `WeekGrid` (grid) and `Ticket` (today).
  Picking a block on paper opens the BLOCK screen in the docked `Terminal`.
- `print` (command) calls `window.print()`, `feed` / FORM FEED refills a torn-off
  printer, and `save` downloads the JSON backup.
- The `crt` utility (`globals.css`) re-points the ink and paper colour tokens, so a
  component placed inside it draws in phosphor without changes.
- `Generating` ends on "View output", which switches to the paper with a feed
  animation.

## Phase 1: the printed copy (state)

- `SavedState.printed?: { blocks: PlacedBlock[]; wakeTime; sleepTime; at: number }`.
  This is the week as it was last printed.
- `rm.printWeek()` copies `rm.schedule` and the hours into `printed`, and clears
  `emptied` / `ticketTornOn` (a PRINT refills every printer).
- `rm.unprinted: boolean` is true when the draft blocks differ from
  `printed.blocks` (compare id, day, start and end) or the hours differ.
- Migration in `storage.ts`: a save with `generated` set and no `printed` gets
  `printed` from its current week on first load, so nobody's paper goes blank.
  `fromJson` does the same.
- Tests: storage migration, `printWeek`, `unprinted` after an edit, a lock, a
  shuffle, and a reprint.

## Phase 2: paper reads the printed copy

- `Printout`, `WeekGrid` and `Ticket` on paper get `printed` instead of
  `rm.schedule`. Filed sheets already work this way (`filed.blocks`), so this
  reuses that path.
- `tearWeek` / `tearTicket` file `printed.blocks`, not `schedule.blocks`.
- `exportIcs` exports `printed.blocks`.
- Paper is read-only: clicking a block on paper switches to the screen with
  that block picked (BLOCK screen open). Nothing on paper edits.
- FORM FEED in an empty slot becomes **PRINT**: it prints the draft. The
  separate FEED command goes away (`feed` stays as an alias of `print`).

## Phase 3: the draft on the CRT

- A screen variant of the week: `WeekGrid` and `Printout` take `onScreen` (or
  `bare`), which drops the `Paper` / `Printer` chrome and renders inside
  `Console`. The `crt` tokens do the colouring.
- New view `"screen"`, the home view once a week exists. The panel's view keys
  become **▣ Screen · ≡ List · ▦ Grid · ◫ Today**. Screen is the draft; the other
  three are paper.
- The screen's width: `Console` already allows 1000px, the same as the grid
  paper. Height grows with the week (the same hour-height fitting `WeekGrid`
  already does against `main`).
- **Editing happens on the screen.** Everything the paper allows today (pick a
  block → lock, move, remove, edit) moves to the CRT:
  - Pick: click a block, or ←↑↓→ to step between blocks (Enter on the bare
    screen picks the first). The picked block is drawn in inverse phosphor.
  - Act: a command strip opens beside the picked block:
    `[L] LOCK · [M] MOVE · [R] REMOVE · [E] EDIT`. These reuse the actions behind
    the BLOCK screen (`rm.toggleLock`, `rm.removeBlock`, the activity editor).
  - Move: a ghost of the block steps with the arrows (↑↓ 15 min, ←→ a day);
    Enter places and locks it (`rm.moveBlock`), Esc cancels. A clash with a
    locked block flashes and says why. Still no drag and drop: it's the MOVE
    screen, drawn on the grid.
  - After any edit, blocks the re-solve moved blink once, so the effect is
    visible.
  - The docked terminal keeps typed commands, FIX, HELP and the activity
    editor. The BLOCK / MOVE screens there become the fallback for phones,
    where the strip has no room.
- Phone: the screen shows the draft as a list (`Printout` in screen mode), as
  the paper does today.

## Phase 4: commands and keys

| Word | Does | Before |
|---|---|---|
| `print` | Draft → paper, with the feed animation; then shows the paper | `window.print()` |
| `save` | The sheet on show → real printer or PDF (`window.print()`) | JSON backup |
| `backup` | JSON backup (the Menu item renamed Backup too) | `save` |
| `feed` | Alias of `print` | Refill a torn-off printer |

- The function row: **PRINT** is lit (alert style, like FIX) while `unprinted`.
  SAVE and EXPORT .ICS sit next to it.
- Status line hint when unprinted: `SCREEN DIFFERS FROM PAPER · PRINT TO UPDATE IT`.
- SAVE or EXPORT with unprinted changes still acts on the paper. The reply
  says so: `SAVED THE PAPER · THE SCREEN HAS UNPRINTED CHANGES`.
- `lib/command.ts`: `FUNCTIONS`, the `print` / `save` / `backup` cases, and the
  HELP manual text. Update `command.test.ts`.

## Phase 5: the reveal on the CRT

- `Generating` doesn't hand off to paper any more. When the solver's readout
  completes, the same screen draws the week in: the grid's columns fill day by
  day, blocks appearing as they're placed (paced like the current stages,
  skippable with Enter or a click).
- It ends on the draft with one primary command: **[Enter] PRINT ▶**. The
  first print is the payoff: the printer feeds out the sheet and the view
  switches to the paper.
- Skipping PRINT there (Esc) leaves you on the draft screen with PRINT lit.

## Phase 6: reviewing the CRT as a whole

The main CRT now has one job at a time:

| State | Main CRT shows | Docked terminal |
|---|---|---|
| No week yet | Boot, then Setup (Requests 01–03) | hidden |
| Generating | Readout, then the week drawing in | hidden |
| Week exists, Screen view | The draft week | prompt + function row; BLOCK / FIX / HELP open in it |
| Week exists, paper view | (paper, not the CRT) | same |

- Should the docked terminal and the main CRT become one screen? Not in this
  pass. Keep the dock as the keyboard and the main CRT as the display, and
  revisit once it's working.
- Update `product.md` §3, §4 (Generate), §9, §10, and the phone section.

## Open questions

1. When you PRINT, should the view jump to the paper (payoff) or stay on the
   screen with the printer lamp blinking? Proposal: jump to the paper the
   first time, stay on the screen afterwards.
2. Is a tear-off of an unprinted draft allowed? Proposal: TEAR always files
   the paper, so it's never ambiguous.
3. Does SAVE on the Screen view save the draft? Proposal: no, it saves the
   last sheet on show (List or Grid), to keep the rule simple.

## Order of work

Phases 1 → 2 → 4 can ship together (paper becomes a copy and PRINT means
print) while the screen view is still being built. Phase 3 then adds the
draft screen, phase 5 the reveal, and phase 6 the documentation.
