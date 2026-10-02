# Robot Mode

> **Decide how you want to spend your time once. Then stop deciding every day.**

Robot Mode is an automatic weekly scheduler.

You tell it when you wake, when you sleep, and what you want to do. It builds a realistic week around your constraints.

It is not an AI assistant. No LLM, no prompts, no API. Deterministic constraint-based scheduling, running entirely in the browser.

---

# 1. Problem

People usually know what they want to do: exercise, read, study, work, learn a language, see people, rest.

Knowing isn't the problem. Structure is.

Without a plan, every day becomes a stream of small decisions:

> "Should I read now?"
> "Can I fit the gym in today?"
> "I wasted the afternoon — how do I fit everything in?"

Calendar apps are good at **recording appointments**. They don't answer:

> **"Given everything I want to do this week, what should my week actually look like?"**

That's the only question Robot Mode answers.

---

# 2. Philosophy

Robot Mode is not about:

- Maximizing every minute
- Metrics, streaks, XP, scores
- AI coaching
- Notifications everywhere

It is about:

> **Build the schedule once. Then execute it.**

The user defines the life. Robot Mode defines the timetable.

It will never say *"you should read more."* It only answers *"you told me you want 14 hours of reading this week — here's where it fits."*

---

# 3. Core loop

```text
DEFINE  →  GENERATE  →  ADJUST ON SCREEN  →  PRINT  →  TEAR OFF / EXPORT  →  LIVE IT
                ↑                                                          │
                └──────────────────────── next week ───────────────────────┘
```

Robot Mode plans a week ahead. The week is set out once, then printed or
exported to a calendar and lived from there; the app is not where the day is
followed minute by minute.

The **screen is the draft, the paper is the commitment**. The week is changed
only on the machine's screen, where it re-solves live. **PRINT** copies it onto
paper, and the paper doesn't change again until the next PRINT. Everything that
leaves the machine (the binder, EXPORT .ICS, today's ticket) is taken
from the paper, so nothing goes out that hasn't been seen on paper.

---

# 4. Core experience

The whole product is one machine: **RM-01**, a 1970s scheduling computer. It
boots, asks its questions on an amber screen, and its output comes out of
printers. The metaphor is the brand, and every action it dresses up is also a
plain key or a plain word.

## Boot

The idle machine: *Robot Mode · Personal scheduling computer · System ready*.
Enter (or a tap) starts the input terminal. Newcomers meet the landing page
first (§20); its Build my week skips the idle screen and opens Request 01.

## Request 01 — What do you want to do?

The list, and nothing else. A single line takes **three fields** — name,
duration (an hours / minutes readout), times a week:

```text
Gym   1H 15M   4×
```

From the last field, Enter walks a short stepper that replaces the line
rather than stacking above it, so the eye stays in one place:

```text
1/3  Days     2/3  Travel buffer     3/3  When
```

**When** offers *Decide for me*, *Always at* (a fixed time) and the presets
*Morning*, *Afternoon*, *Evening*; choosing a fixed time hides the presets. Every
step can be skipped, which stores nothing and leaves the choice to the engine —
except the buffer, where skipping means zero. Added activities stack above the
line; each can be reopened to change it.

**Load a template** sits under the list, never in front of it (§12).

## Request 02 — Operating hours

**Wake** and **Sleep**, set like instruments: two big clock readouts, ↑ ↓ or
typed digits. Defaults 07:30 and 23:30.

## Request 03 — Meals

Breakfast, lunch and dinner, each at a time and for a length, and **every meal
starts off**. Reserving someone's evening for a dinner they never asked for is a
worse default than asking for one click. Extra meals can be added. Meals are
the shape of a day, not things to get done, so they never appear in the list.

## Generate

**Make me a robot** runs the solver (about 30 ms) and paces the reveal over a
few seconds, showing what it is actually doing; a click or Enter skips it. The
screen then draws the week in, a day's column at a time, as a draft, with the
keyboard's PRINT lamp lit. The first PRINT turns to the paper and shows the
sheet coming out of the printer. After the reveal the draft re-solves live on
every edit. The pause belongs to the reveal, not to editing.

---

# 5. Data model

```ts
type Activity = {
  id: string
  name: string
  durationMinutes: number        // length of ONE session
  sessionsPerWeek: number
  allowedDays?: Day[]            // default: all
  window?: { start: string; end: string }   // soft preference
  bufferMinutes?: number         // travel / transition, both sides
  fixedAt?: { start: string; days?: Day[] } // same clock time every session
  extraOf?: string               // a one-off extra session of another activity
  priority?: Priority            // internal only: meals are critical
}

type Meal = { id: string; name: string; start: string; durationMinutes: number; enabled: boolean }

type Settings = {
  wakeTime: string
  sleepTime: string
  activities: Activity[]
  meals?: Meal[]                 // all off by default
  seed: number
}
```

## Why it looks like this

**No splittable/atomic distinction.** Duration is one session; frequency is
sessions per week. "Work 4h/day" is `2h × 14/week`.

**One `window`** instead of preferred time + preferred days + flexibility. It is
soft: the engine leaves it only when nothing else fits, and says so.

**No priority for people.** Every activity they add weighs the same. Priority
survives only inside the engine, so meals are placed first and never given up.

**No free-time setting.** Free time is what the activities leave. Anyone who
wants a break kept adds it, like anything else: `ADD BREAK 1H DAILY`.

**Meals are not activities.** An enabled meal becomes a fixed, critical session
on all seven days when the week is solved, but it stays out of the list.

---

# 6. Scheduling engine

Deterministic, client-side, no solver library (`lib/scheduler/`).

The week is a grid of 15-minute slots: **7 × 96 = 672**.

1. Block out sleep, fixed-time sessions and locked blocks.
2. Place meals, then every other session by its best-scoring free slot.
3. Repeat with 20 seeded passes, shuffling order within each tier. Keep the best week.

## Scoring a candidate slot

- Inside the activity's window?
- Same time of day as its other sessions? *(consistency)*
- A second session the same day? *(heavily penalised)*
- A session of the same activity the day before or after, when it has fewer
  sessions than allowed days? *(spread: Gym 4× reads Mon Wed Fri Sun, not two
  back-to-back pairs)*
- In the first hour after waking, for an activity with no window? *(nothing is
  put the minute the alarm goes off)*
- Squatting on hours a windowed activity is competing for? *(contention)*
- Leaving an orphan gap of half an hour or less?

## Hard constraints

No overlaps; sleep protected; allowed days respected; fixed and locked blocks
never move; everything inside waking hours.

## Determinism

The RNG is seeded. Same input, same week — always. **Shuffle** asks for a
different arrangement with a new seed.

## Explainability

Every placed block records a one-line reason (*"Inside 17:00–19:30 window; best
fit at 17:15"*), shown when the block is picked.

---

# 7. Time budget

On the terminal's status line, always visible once a week exists:

```text
PLANNED 68.3H OF 112H AVAILABLE · over by 6H
```

It stays out of the input terminal, which is kept to one question at a time.

---

# 8. Conflicts

A budget that fits is not a week that fits: hours can be free and still be in
the wrong places. When something can't be placed, the terminal's **FIX** key
lights red with the count, and the Fix screen says why each one failed, naming
what was in the way:

```text
Gym       0/4  — 08:00 clashes with Breakfast at 09:00
Dawn run  0/2  — 05:00 doesn't fit between waking up and going to sleep
```

Each conflict offers up to three ways out, and **none is a guess**: a short
catalogue of small tweaks is generated, each is tried by re-solving, and only
those that genuinely resolve it without breaking more are shown. Cheapest
first — nudge one block, then change wake time, then shorten or drop a session.
Applying one is always the user's choice.

---

# 9. Editing the week

The screen and the paper only **show** the week. Every change is typed on the
keyboard unit's readout (or reached through its function keys); nothing is
changed by clicking a session:

```text
move gym monday 10h to 11h · lock gym monday · unlock gym monday · lock gym
remove gym wednesday · edit deep work monday 2h · shuffle · clear
```

- **Move** a session to another day or time; it is locked there
- **Lock** / **Unlock**: keep it through shuffles and edits (a day, a day and
  a start, or every session of the activity)
- **Remove** one session from this week
- **Edit** the activity, or one session only (it becomes an extra, kept at its time)

After any edit, the sessions the re-solve moved flash on the screen, so its
effect can be followed.

Locking is the intended way to keep what is right: lock it, then shuffle or
edit, and everything else rearranges around it. **No clicking, no drag and drop and
no resize**: dragging is manual scheduling, the thing the product exists to remove.

There is no "I missed this": the week is printed or exported and lived from
there, not followed inside the app.

---

# 10. The terminal

The machine has **one screen and one keyboard**. The screen keeps the same
frame from boot to setup to the draft; on the paper views the printers take
its place. Under either sits the **keyboard unit**, part of the beige casing,
not a second screen: the hours, activities and budget printed on it, a row of
function keycaps — **ADD · EDIT · SHUFFLE · PRINT · EXPORT .ICS · SYSTEM · HELP**,
plus **FIX** and **CLEAR EDITS** when they apply — and a prompt that takes commands in shorthand
or plain words, completing as you type:

```text
gym 1h15 4x · add yoga 45 min twice · remove gym · wake 7 · sleep 11pm
remove gym wednesday · shuffle · print · export · screen · grid · list · today · tear · backup · help
```

A function's screen (EDIT, HELP, FIX, SYSTEM…) opens on the
machine's screen, at full size, in place of the week or the paper; Esc or a
view key puts the week back. The keyboard's own display is a single readout
line to type on, with the answer under it.

**PRINT**'s lamp lights red while the screen has changes the paper doesn't, and the
line under the prompt says so. The terminal and the screen are where things
are done; the paper only shows. The panel keeps the four view keys and the
Menu (sound, clock, backup), and the printers keep only their lamps.

Everything the prompt does is also reachable with the mouse or a tap. Anything
that throws work away (restart, reset to a template) is confirmed on the
terminal with Y / N, never by a browser dialog.

---

# 11. Output

The panel shows the **Screen** (the draft, §9), then the week on paper, three
ways:

- **List** — the line printer: each day as a printed list of times.
- **Grid** — the plotter: seven columns, the whole week at a glance.
- **Today** — the ticket printer: just today's lines, as a receipt to pocket.

All three print the same week, the one last PRINTed. **PRINT** puts the draft
on paper and refills every empty printer. The first time, the machine turns to
the paper to show it coming out; after that you stay on the screen.
**EXPORT .ICS** sends the week on paper to a calendar (§13). To get a sheet onto
a real printer, or into a PDF, tear it off and **Download** it from the binder. With
nothing printed yet, the printers stand empty with a PRINT key, and EXPORT and
TEAR say so instead of acting.

**Tear off** is done on the paper itself: every sheet that can be torn off
has a lit **Pull down to tear off** tab on its perforation, scissors at either
end, a grab hand over it, and now and then gives a small tug. Pulling it down
(or typing TEAR, for the keyboard alone) files the sheet on show in the
**binder** (the archive drawer at the right edge, up to two years of weeks).
Only that printer empties: each has its own paper, so tearing the grid leaves
the list where it is. It stays empty, through view switches and reloads, until
the next PRINT (the empty slot's key, or typed). Mid-week
a tear-off only files a copy; once the week is over the line under the prompt
says so, and that tear-off also clears the week's locks and edits. Filed sheets can be drawn out, read, printed, or
**shredded**. A sheet drawn out of the binder has **Download** (a PDF, or your
printer, through the browser's print dialog), **Shred** and **Put back**.

**Today's ticket** tears off the same way and is filed behind its own divider,
◫ Tickets, one per day: a fresh ticket torn off later that day replaces the
earlier one. Only the ticket printer empties; the week is untouched, and the
next day's ticket prints by itself.

## Phone

On a phone the panel folds to one row of view keys under the nameplate, the
terminal's function keys wrap onto two lines, the printers show only their slot, and the
screen shows the draft as a list, which reads top to bottom. Its paper is the
**List**; the grid scrolls sideways.
Keyboard hints are hidden on touchscreens, and the prompt doesn't grab focus,
so no on-screen keyboard covers the week on arrival.

---

# 12. Templates

A shortcut for people who want one, not the front door. **Load a template**
under the list opens the library on the same screen; replacing a list already
entered is confirmed first. Picking one fills the list and goes straight to
the reveal. SYSTEM can later reset to the template the week came from.

- Student
- Entrepreneur
- Full-time worker
- Fitness-focused
- Exam preparation
- Deep work
- Blank week

---

# 13. Export and moving a setup

## ICS

**Export .ics** produces a file for Google Calendar, Apple Calendar or Outlook,
for the Monday–Sunday of the current week, from the week on paper.

- **Stable UIDs** from the session id, so re-exporting *replaces* events
  instead of duplicating them.
- A **sequence** bumped on every export, so calendars accept the update.
- **`X-WR-CALNAME: Robot Mode`** — one named calendar, deletable in one click.

## Backup

**Backup** downloads the full state as JSON (setup, locks, the week on paper,
binder); **Load**
reads it back. A file that isn't a backup is refused with a line under the
panel.

## Setup link

**Copy setup link** puts the hours, meals and activities into a link
(`#setup=…`). Opened on another device, or by someone else, it loads that setup
and solves the week afresh — the same setup gives the same week. A machine that
already has a list asks before replacing it. No account and no server: the
link carries everything.

---

# 14. Architecture

```text
Settings + locks + printed week + binder (localStorage, versioned)
       ↓
  Scheduler (client-side, deterministic)
       ↓
  Screen (the draft)  +  Terminal
       ↓ PRINT
  List / Grid / Today (the paper)
       ↓
  binder (download: PDF / printer) · ICS · JSON · setup link
```

- Next.js, TypeScript, Tailwind; one client page
- No backend, no database, no auth, no dependencies beyond the framework
- localStorage with a version field and a try/catch fallback; the browser is
  asked to keep it persistent (Safari otherwise clears it after a week unvisited)

No API costs. No AI costs. Effectively free to operate.

---

# 15. Privacy

> **Your schedule stays on your device.**

No routines sent to a model. No account. Nothing collected. A setup link
carries the setup inside the link itself; nothing is uploaded.

Calendar integration (V2) changes this, and should be opt-in and clearly explained.

---

# 16. Scope

## Built

- Three-field activity line, with days, travel buffer and when
- Wake / sleep, meals
- Deterministic weekly generation, conflicts with verified fixes
- List, grid and today ticket; print
- Edit, this-session-only, move, lock, remove; shuffle
- Templates
- Terminal with commands
- Binder: tear off, file, shred
- ICS export, JSON backup, setup link
- Phone layout

## Don't build

- AI, of any kind
- Drag and drop, resize
- Accounts, backend, cloud sync
- Two-way calendar sync
- Mobile app
- Habit tracking, streaks, gamification
- Notifications
- Social features, collaboration

## Next

- Analytics, privacy-friendly, once there are users to learn from

## The only question that matters

> **Can Robot Mode generate a week that people actually follow?**

Give it to ~10 people and ask after a week whether they followed it. Calendar
sync is where OAuth, a backend and real complexity begin — don't start it
until that question is answered.

---

# 17. V2

Only after validation:

- Google Calendar read — treat existing events as fixed constraints
- Write to a dedicated "Robot Mode" calendar
- Daily regeneration
- Saved / multiple schedules
- "I have less time today" — recalculate the remainder around a shortened day

# 18. V3

- Apple Calendar
- Adaptive scheduling — learn which times actually get honoured
- Weekly review: *"You completed 4 of 5 language sessions. Keep the same schedule next week?"*

---

# 19. Business model

**Free** — schedules, local storage, printing, ICS export, setup links. Genuinely useful on its own.

**Pro, €4–8/month** — calendar sync, automatic rescheduling, multiple schedules, cloud sync, history.

The free tier has to be good enough that people use it daily. Pro sells convenience, not access.

---

# 20. Positioning

Not:

> "AI that plans your life."

But:

> **A constraint-based automatic scheduler for your entire week.**

One sentence:

> **Tell Robot Mode what you want to do. It figures out when.**

## Taglines

- **Stop deciding. Start doing.**
- Give us your constraints. Get your week.
- Decide once. Follow the schedule.
- Wake. Execute. Sleep. Repeat.

## Landing page

**Hero**

# Stop deciding what to do next.

Tell Robot Mode when you wake, when you sleep, and everything you want to get done. It builds your week around your constraints.

**[ Build My Week ]**

*No AI. No setup. No account.*

**Demo** — a sample setup on the screen (five lines, wake and sleep), and what
the machine prints from it: the plotted week and Wednesday's ticket. Solved by
the real engine when the page is built, not drawn.

The landing page is `/`; the machine is `/app`. Someone with a week already
printed skips straight to it (`/?home` shows the landing anyway), and setup
links made for `/` are passed on to `/app`.

---

# 21. Naming

**Robot Mode** is the product name. Playful, memorable, and it supports a real visual identity.

It isn't about becoming a robot. It describes the feeling of not having to decide what comes next.

*Rigid Schedule* — the working directory name — describes the concept accurately but is utilitarian and forgettable.

Decided: **Robot Mode**, presented as the RM-01.

---

# 22. Design principles

1. **Three fields to add an activity.** Everything else is optional.
2. **Never show an error where a live number would do.**
3. **Same input, same week.** Always.
4. **Every block can explain itself.**
5. **Free time is what the week leaves.** Anyone who wants a break kept adds it.
6. **When in doubt, cut the field.**
