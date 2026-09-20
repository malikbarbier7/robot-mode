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
DEFINE  →  GENERATE  →  LOCK / ADJUST  →  EXPORT  →  LIVE IT
                ↑                                        │
                └──────────── something changed ─────────┘
```

---

# 4. Core experience

## Step 1 — Your list

The first screen is the list, and nothing else. A single line — name, duration,
how many times a week — and everything you add stacks up beneath it, numbered.

The list is the product. Anything that competes with it on the first screen,
templates included, is pushing the user away from the thing they came to do.

Above the input, the frame it all has to fit inside: **Wake** 07:30, **Sleep** 23:30,
and how much free time a day to protect. The hours come first — you decide how big
the container is before you decide what goes in it.

## Step 2 — Add activities

Adding an activity takes **three fields**:

```text
Gym, 1h15, 4×
```

**Add** commits it there and then. **Next** hands the same row over to a stepper
that walks through the rest, one question at a time. It replaces the inputs rather
than stacking above them, so the block never changes height and the eye stays in
one place:

```text
1/4  Days     2/4  Priority     3/4  Travel buffer
4/4  When  ( Decide for me | Preferred window | Always at )
```

A preferred window and a fixed time are one question answered two ways, so they
share the last step. The presets set a window directly — there is no mode to pick
first — and choosing **Always at** hides them, since a fixed time makes a window
meaningless. Custom start and end times live in the row editor, which has room.

Every step can be skipped, which stores nothing and leaves the choice to the
engine. The wording matters — **Decide for me** on days, priority and when, but
**No buffer** on travel time, because skipping that means zero rather than a
decision handed to the scheduler. Nothing is echoed back between steps. The controls show their own state, and a
running summary beside them was only noise.

This is where preferences belong. Collected up front, the first generated week is
one you can live with; collected afterwards, every week starts as something to fix
by hand — which is the friction the product exists to remove.

The promise is still "stop deciding", so the stepper is opt-in: three fields and
Add remains the fast path.

## Step 3 — Watch the budget

As activities are added, a live bar shows the week filling up:

```text
87h of 112 waking hours allocated          ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░
```

There is no separate "impossible schedule" error screen. Infeasibility is simply the bar going past 100%, with the lowest-priority offender named.

## Step 4 — Generate

**GENERATE MY WEEK** is the moment the product exists for. The solver finishes in
about 30ms, but the reveal is paced over roughly four seconds, showing what it is
actually doing — protecting sleep, placing sessions by priority, spreading them
across seven days, reserving free time, comparing twenty arrangements. A click
skips it.

After that first reveal the week re-solves live on every edit, with locked blocks
held in place. The pause belongs to the reveal, not to editing.

Example Monday:

| Time | |
|---|---|
| 07:30-08:00 | Breakfast |
| 08:00-10:00 | Reading |
| 10:00-11:00 | Language |
| 11:00-12:00 | Work |
| 12:00-13:00 | Lunch |
| 13:00-16:00 | Work |
| 16:00-17:15 | Gym |
| 17:15-18:15 | Class study |
| 18:15-19:15 | Dinner |
| 19:15-23:30 | Free |

---

# 5. Data model

Deliberately small. Eight fields, five of them optional.

```ts
type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

type Activity = {
  id: string
  name: string
  durationMinutes: number        // length of ONE session
  sessionsPerWeek: number
  priority: "critical" | "high" | "medium" | "low"

  allowedDays?: Day[]            // default: all
  window?: { start: string; end: string }   // soft preference, e.g. "18:00"–"23:00"
  bufferMinutes?: number         // travel / transition, applied both sides
  fixedAt?: { day: Day; start: string }     // appointments
}

type Settings = {
  wakeTime: string
  sleepTime: string
  activities: Activity[]
  minFreeMinutesPerDay: number   // protected unscheduled time
  seed: number
}
```

## Why it looks like this

**No splittable/atomic distinction.** Duration is one session; frequency is sessions per week. "Work 4h/day" is expressed as `2h × 14/week` and the placer naturally puts two on each day. Splitting falls out of the model instead of needing a field.

**One `window` instead of `preferredTime` + `preferredDays` + `flexibility`.** The window is a *soft* preference — the engine violates it only when nothing else fits, and says so.

**Flexibility is derived.** `fixedAt` present means fixed. Otherwise flexible.

**`bufferMinutes` earns its place.** Gym 16:00–17:15 ignores the commute and the shower. Ten lines of engine code, and the difference between a schedule that looks right and one that survives Tuesday.

**`minFreeMinutesPerDay` replaces a relaxed/balanced/rigid setting.** Same outcome, but concrete and directly enforceable rather than a mood the engine has to interpret.

**Dropped:** `minimumGap`, `maximumConsecutive`, `category`, `preferredDays`, `flexibility`. Add back only when a real test week needs them.

---

# 6. Scheduling engine

Deterministic, client-side, roughly 250 lines. No solver library.

The week is a grid of 15-minute slots: **7 × 96 = 672**.

1. Block out sleep, `fixedAt` activities, and locked blocks.
2. Cap each day at `waking − minFreeMinutesPerDay`, so free time is structurally protected rather than hoped for.
3. Sort sessions by priority.
4. Place each session in its best-scoring free slot.
5. Repeat with 20 seeded passes, shuffling order within each priority tier. Keep the best-scoring week.

## Scoring a candidate slot

- Is it inside the activity's `window`?
- Is it at the same hour as this activity's already-placed sessions? *(consistency)*
- Is this day already overloaded relative to the others? *(spread)*
- Is it late at night for a high-priority activity?
- Is it squatting on hours that a windowed activity is competing for? *(contention)*

## Hard constraints

Never violated:

- No overlaps
- Sleep is protected
- `allowedDays` respected
- `fixedAt` blocks cannot move
- Locked blocks cannot move
- Everything fits inside waking hours

## Consistency is the default

Same activity, same time, most days. Habits are built by repetition at a fixed hour; a language session that wanders across the morning is much harder to keep. Variety is not offered as an equal option.

## Determinism

The RNG is seeded. Same input, same week — always. A scheduler that produces a different answer each time it runs feels arbitrary, and arbitrary kills trust.

Two distinct actions:

- **Re-solve** — after an edit. Stable, preserves locks.
- **Shuffle** — explicitly asks for a different arrangement. New seed.

## Explainability

Every placed block records a one-line reason:

> *"Evening window; 18:00–19:15 taken by Gym; earliest evening fit."*

This is a `reason: string` written during placement, not a reasoning engine. It's cheap here and impossible to retrofit later — and it's something no LLM planner can do honestly.

---

# 7. Time budget

The most important screen element.

```text
You've allocated 118h of 112 waking hours.

Over by 6h.
Lowest-priority activity: Extra leisure (7h/week).
```

Live, always visible, updating as you type. This is the thing a calendar structurally cannot do, and it should be what the landing page animates.

---

# 8. Locking and regenerating

Any block can be **locked**.

```text
Monday 16:00–17:15
Gym  🔒
```

Locked blocks never move. Everything else rearranges around them.

Change reading from 2h to 1h, hit re-solve, and the week rebuilds while your locked blocks stay exactly where they are.

**This is the intended editing model.** If a block is in the wrong place: lock what you like, re-solve. Manual dragging is the thing the product exists to eliminate.

---

# 9. Free time

Robot Mode does **not** fill every minute.

`minFreeMinutesPerDay` is a hard cap on how much of a day can be allocated. The remainder is simply:

```text
Free — 19:15–23:30
```

The user decides spontaneously: partner, friends, family, a film, nothing at all.

This is also how "people time" works. Rather than scheduling *"Girlfriend — Monday 20:00"*, you reserve 2h/day of unscheduled time and live in it.

Without this, the product becomes another hyper-optimized productivity tool, which is exactly what it is trying not to be.

---

# 10. Weekly view

Desktop-first. Seven columns.

```text
MON   TUE   WED   THU   FRI   SAT   SUN
```

Per block: **lock**, **delete**, **why here?**

The week should feel tangible — you look at it and immediately think *this is my week*.

**No drag and drop in v1, and no resize.** Not only for build cost: dragging is manual scheduling. Resize edits a duration through a gesture that then contradicts the activity's declared duration, which is a modelling mess for little gain. If people reach for dragging anyway, that's real signal and it gets added then.

---

# 11. Now view

The daily-use surface. One card, large type.

```text
🤖 NOW
Work — until 13:00

NEXT
Lunch — 13:00–14:00
```

Without this, Robot Mode is a generator you use once and never open again. This is the screen that sits on a second monitor, and it's where the brand actually lands.

## "I missed this"

One tap. The rest of today re-solves with `now` as the start boundary and past blocks frozen.

The failure mode of any rigid schedule is that a single miss makes the whole plan feel dead. This is the repair valve — and mechanically it's the same code path as re-solve, so it's nearly free.

---

# 12. Templates

Templates are a shortcut for people who want one, not the front door. They live
behind a single line under the list — *"Not sure where to start? Use a template →"* —
and picking one fills the list and goes straight to the reveal.

They must never take the first screen. Putting them there inverts the whole
product: it turns "tell me what you want to do" into "pick one of ours".

The define panel can roll the activity list back to the template it came from:

- Student
- Entrepreneur
- Full-time worker
- Fitness-focused
- Exam preparation
- Deep work
- Blank week — no activities, for people who would rather start from nothing

---

# 13. Export

## ICS

**Export to Calendar** produces a `.ics` importable into Google Calendar, Apple Calendar, or Outlook.

Two things that matter:

- **Stable UIDs** — a hash of activity id + slot, so re-exporting *replaces* events instead of duplicating them. Without this, a second export wrecks someone's calendar and they never come back.
- **`X-WR-CALNAME: Robot Mode`** — the whole thing lands as one named calendar, deletable in a single click.

Plain discrete events, no `RRULE` compression. Sixty events is fine.

## JSON

Export and import the full configuration. Cheap insurance against losing a twenty-minute setup to a cleared browser.

---

# 14. Architecture

```text
Settings (localStorage)
       ↓
  Scheduler (client-side, ~250 lines)
       ↓
  Weekly view  /  Now view
       ↓
  ICS export
```

- Next.js, TypeScript, Tailwind
- No backend, no database, no auth
- No dependencies beyond the framework
- localStorage with a `version` field and a try/catch fallback

No API costs. No AI costs. Effectively free to operate.

---

# 15. Privacy

Because it runs locally, this is a genuine position and not a marketing line:

> **Your schedule stays on your device.**

No routines sent to a model. No account required. Nothing collected.

Calendar integration (V2) obviously changes this, and should be opt-in and clearly explained.

---

# 16. MVP scope

## Build

- Wake / sleep times
- Two-field activity add, advanced fields collapsed
- Priority, allowed days, soft time window, buffers
- Live time budget
- Deterministic weekly generation
- Weekly calendar view
- Lock, delete, "why here?"
- Re-solve and shuffle
- Templates
- Now view + "I missed this"
- ICS export with stable UIDs
- JSON export / import
- localStorage

## Don't build

- AI, of any kind
- Drag and drop, resize
- Accounts, backend, cloud sync
- Two-way calendar sync
- Mobile app
- Habit tracking, streaks, analytics, gamification
- Notifications
- Social features, collaboration

## The only question that matters

> **Can Robot Mode generate a week that people actually follow?**

Everything else is downstream of that.

---

# 17. Build plan

Roughly one week of focused work.

**Phase 0 — Scaffold** *(½ day)*
Next.js + TS + Tailwind. `lib/types.ts`. localStorage with version field and fallback.

**Phase 1 — Engine, headless** *(1–2 days)*
`lib/scheduler/`. No UI. Five fixture weeks as tests: comfortable, tight, impossible, all-locked, gym-restricted-to-four-days. Everything else is a view over this, and it's the only phase where being wrong is expensive.

**Phase 2 — Define screen** *(1 day)*
Wake/sleep, activity list, two-field quick-add, advanced panel, live time budget, templates as empty state.

**Phase 3 — Weekly view** *(1–2 days)*
Seven columns, blocks, lock, delete, re-solve on edit, "why here?" popover.

**Phase 4 — Export** *(½ day)*
ICS with stable UIDs and calendar name. JSON export/import.

**Phase 5 — Now view** *(1 day)*
Now/Next card, "I missed this".

**Then stop.** Ship it, give it to ~10 people, ask after seven days whether they followed the week they generated. Google Calendar sync is where OAuth, a backend, and real complexity begin — don't start it until the core question is answered.

---

# 18. V2

Only after validation:

- Google Calendar read — treat existing events as fixed constraints
- Write to a dedicated "Robot Mode" calendar
- Daily regeneration
- Saved / multiple schedules
- "I have less time today" — recalculate the remainder around a shortened day

# 19. V3

- Apple Calendar
- Adaptive scheduling — learn which times actually get honoured
- Weekly review: *"You completed 4 of 5 language sessions. Keep the same schedule next week?"*

---

# 20. Business model

**Free** — schedules, local storage, ICS export, Now view. Genuinely useful on its own.

**Pro, €4–8/month** — calendar sync, automatic rescheduling, multiple schedules, cloud sync, history.

The free tier has to be good enough that people use it daily. Pro sells convenience, not access.

---

# 21. Positioning

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

**Demo** — the time-budget bar filling as activities appear, then the week snapping into place.

---

# 22. Naming

**Robot Mode** is the product name. Playful, memorable, and it supports a real visual identity.

It isn't about becoming a robot. It describes the feeling of not having to decide what comes next.

*Rigid Schedule* — the working directory name — describes the concept accurately but is utilitarian and forgettable.

**Open decision:** settle this before Phase 0. It touches the package name, the repo, and any domain purchase.

---

# 23. Design principles

1. **Two fields to add an activity.** Everything else is advanced.
2. **Never show an error where a live number would do.**
3. **Same input, same week.** Always.
4. **Every block can explain itself.**
5. **Free time is a feature, not leftover space.**
6. **When in doubt, cut the field.**
