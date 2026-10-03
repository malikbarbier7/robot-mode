/**
 * The landing page's copy that shows lines typed at the machine: the steps,
 * the engine's rules and the questions. Kept apart from the page so a test can
 * hold every one of those lines to being a real command.
 */

/** The four steps, each with what is actually typed at the machine's keyboard for it. */
export const STEPS = [
  {
    title: "List what you want",
    body: "A line each: a name, how long, how many times a week. Then when you wake, sleep and eat. Pin what can't move, like work or classes, to its hours.",
    line: "gym 1h15 4x",
  },
  {
    title: "It finds the time",
    body: "Every session gets a slot: in the hours you prefer, spread across the week, around meals, travel time and each other. Don't like it? Ask for another arrangement.",
    line: "shuffle",
  },
  {
    title: "Adjust, then lock it in",
    body: "Move a session and the rest re-plans around it. When it looks right, print it: that's the version you follow. No printer needed.",
    line: "move gym mon to tue",
  },
  {
    title: "Follow it",
    body: "Export the week to Google Calendar, Apple Calendar or Outlook, download it as a PDF, or pocket today's ticket.",
    line: "export",
  },
]

/** The rules the engine places a session by, in the visitor's terms. */
export const RULES = [
  { title: "Your preferred hours", body: "Gym in the evening, reading before bed. A session leaves its window only when nothing else fits, and then it says so." },
  { title: "Spread across the week", body: "Gym 4× lands Monday, Wednesday, Friday and Sunday, not two back-to-back pairs." },
  { title: "Built around real life", body: "Meals, travel time either side, and the first hour after you wake stay clear." },
  { title: "Fixed where you need it", body: "Work, classes, a weekly call: pin them to their hours, like `work 8h 5x at 9:00 weekdays`, and the rest is planned around them." },
  { title: "Same input, same week", body: "No AI and no guessing. Every block can tell you why it's where it is." },
]

/** What people ask before they try it. Lines in backticks are real commands: a test keeps them so. */
export const FAQ = [
  {
    q: "What about my job, classes or fixed meetings?",
    a: "Pin them. Give an activity a fixed time and days, like `work 8h 5x at 9:00 weekdays`, or choose Always at when adding it, and everything else is planned around it.",
  },
  {
    q: "Does it sync with Google Calendar?",
    a: "One way, for now. Export the week as an .ics file and Google Calendar, Apple Calendar or Outlook shows it as a calendar of its own; exporting again updates it instead of duplicating it. Robot Mode doesn't read your calendar.",
  },
  {
    q: "Do I need a printer?",
    a: "No. Print is the machine's word for \"this is the version I'll follow\": it's the plan you export, download as a PDF or keep on screen. Printing it on real paper is up to you.",
  },
  {
    q: "What if I miss a session, or my week changes?",
    a: "Change it on the screen: move, remove or lock a session, and the rest re-plans around it at once. Robot Mode plans the week; it doesn't track you or nag you.",
  },
  {
    q: "How is it different from time-blocking, or from Motion and Reclaim?",
    a: "Time-blocking by hand means solving the puzzle yourself, every week. AI planners solve it for you, but run on an account and your calendar. Robot Mode solves it in your browser, with no account, and can tell you why each block is where it is.",
  },
  {
    q: "Does it work on a phone?",
    a: "Yes: on a phone the week reads as a list, top to bottom. Setting it up is quickest on a computer, where there's a real keyboard to type at.",
  },
  {
    q: "Is it really free? Where is my data?",
    a: "Free, with no account. Everything stays in your browser on this device and nothing is uploaded. Back it up to a file, or move it to another device with a setup link.",
  },
]

/** Every line the landing page shows typed at the machine: the steps' readouts, and `lines like this` in its copy. */
export const LANDING_LINES = [
  ...STEPS.map((s) => s.line),
  ...[...RULES.map((r) => r.body), ...FAQ.map((f) => f.a)].flatMap((text) => text.split("`").filter((_, i) => i % 2)),
]
