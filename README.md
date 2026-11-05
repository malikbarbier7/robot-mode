<div align="center">

# 🤖 Robot Mode

**Tell it what you want to do. It finds the time.**

A free, automatic weekly scheduler styled as a 1970s computer.
No AI. No account. No server. Your week never leaves your browser.

[**Try it → getrobotmode.com**](https://www.getrobotmode.com)

</div>

---

```text
┌─ RM-01 ───────────────────────────────────────────────┐
│                                                       │
│  > gym 1h15 4x                                        │
│  > reading 1h 5x                                      │
│  > work 8h 5x at 9:00 weekdays                        │
│  > shuffle_                                           │
│                                                       │
│  PLANNED 68.3H OF 112H AVAILABLE                      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## What it does

You list what you want in a week (a name, how long, how many times) plus when you wake, sleep and eat. Robot Mode places every session on a 15-minute grid, around your sleep, meals, travel time and fixed commitments. Then you adjust it, lock it in, and export it.

Calendar apps record appointments. Robot Mode answers a different question: *given everything I want to do this week, what should my week look like?*

## Why it's different

- **No AI.** The scheduler is a deterministic, seeded constraint solver. Same input, same week, every time.
- **It explains itself.** Every block can tell you why it landed where it did.
- **Honest about conflicts.** When something doesn't fit, it says what's in the way and offers fixes that were actually tried, not guessed.
- **Local-first.** Everything lives in `localStorage`. Nothing is uploaded, there are no cookies, no login.
- **Plan once, then live it.** Export to Google Calendar, Apple Calendar or Outlook (`.ics`), save a PDF, or pocket today's ticket.

## Talk to the machine

The week is edited by typing, not dragging:

```text
move gym monday 10h to 11h      lock gym monday
remove gym wednesday            edit deep work monday 2h
shuffle                         export
```

## Run it yourself

Needs Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm test         # vitest: scheduler, commands, .ics export, ...
npm run lint
npm run build    # static export to out/
```

## How it's built

- **Next.js** (App Router, static export) · **React** · **Tailwind CSS** · **TypeScript**
- The scheduler is plain TypeScript with no solver library: [`lib/scheduler/`](lib/scheduler)
- The whole site is plain files in `out/`, so any static host works. The live site runs on Cloudflare.
- The full design, from philosophy to scoring rules, is in [`product.md`](product.md).

## Contributing

It's a fun side project and there's no money in it. Issues and ideas are welcome. Pull requests too, but please open an issue first for anything big.

Built by [@malikbuilds](https://x.com/malikbuilds). Released under the [MIT License](LICENSE).
