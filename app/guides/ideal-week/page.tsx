import { Article, ExampleWeek, TryIt, Typed, guideMetadata } from "@/components/Article"
import { guideBySlug } from "@/lib/guides"

const guide = guideBySlug("ideal-week")
export const metadata = guideMetadata(guide)

export default function IdealWeek() {
  return (
    <Article guide={guide}>
      <p>
        An ideal week is your week as it should look when things go well: when you train, when you do your best work, when you read, when
        you&rsquo;re off. It isn&rsquo;t a fantasy schedule. It&rsquo;s a default, a week you plan <em>against</em>, so you stop rebuilding
        your schedule from a blank page every Sunday night.
      </p>
      <p>
        The idea has been popular with productivity writers for years, and for good reason: most weeks look alike. Designing the shape once
        and reusing it beats re-deciding the same things fifty-two times a year.
      </p>

      <h2>Why a default week works: fewer decisions</h2>
      <p>
        Every unplanned hour comes with a small decision attached: what now? Each one is easy. Together, they wear you down, and the
        option that wins at the end of a long day is rarely the one you&rsquo;d have chosen in the morning. Psychologists call the idea{" "}
        <strong>decision fatigue</strong>. How strong the effect is remains debated in research, but the everyday experience is familiar:
        the gym session you planned &ldquo;sometime this week&rdquo; is the one that doesn&rsquo;t happen.
      </p>
      <p>
        An ideal week removes those decisions in advance. Training is on Monday, Tuesday, Thursday and Friday at 17:30, so on Tuesday at
        17:00 there is nothing to decide.
      </p>

      <h2>How to design your ideal week, in five steps</h2>

      <h3>1. Start with what you can&rsquo;t move</h3>
      <p>
        Sleep, meals, work or class hours, the school run. Put these in first; they&rsquo;re the walls everything else has to fit between.
        Be honest about sleep: an ideal week that only works on six hours a night isn&rsquo;t ideal.
      </p>

      <h3>2. Choose what matters, and how often</h3>
      <p>
        Pick the three to six recurring activities that make a week good for you, and how many sessions each deserves. Not everything you
        could do: what you want to be true of a typical week.
      </p>
      <Typed>training 1h30 5x</Typed>
      <Typed>side project 2h 2x</Typed>
      <Typed>reading 45m daily</Typed>

      <h3>3. Match activities to your energy</h3>
      <p>
        Give each activity the part of the day it deserves. Hard, creative work in your sharpest hours (usually the morning). Training when
        you have the energy and the gym is open. Low-stakes things like admin at the end of the day. A preferred window is enough; you
        don&rsquo;t need exact times.
      </p>

      <h3>4. Leave slack on purpose</h3>
      <p>
        An ideal week that fills every hour breaks the first time anything runs late. Keep at least one evening and a good part of the
        weekend unplanned. Slack isn&rsquo;t a failure of planning; it&rsquo;s what lets the plan survive a real week.
      </p>

      <h3>5. Make it real: place it, print it, use it as the default</h3>
      <p>
        Put every session on an actual timetable, around your sleep and meals, and check it fits. Then print it. From now on, each week starts
        as a copy of the ideal one, and you only change what this particular week needs.
      </p>

      <h2>Ideal week examples</h2>
      <p>
        Two very different ideal weeks, both placed by the same engine from a handful of lines. A founder&rsquo;s week defends the mornings
        for building and gives the afternoons to everyone else:
      </p>
      <ExampleWeek
        templateId="entrepreneur"
        caption="Three hours of building every weekday morning, calls and outreach in the afternoons, admin batched at the end of the day, two catch-up blocks at the weekend."
      />
      <p>And a training-first week puts the sessions in before anything else, with work fitted around them:</p>
      <ExampleWeek
        templateId="fitness"
        caption="Ninety minutes of training six mornings a week with travel time kept, two work blocks each weekday, mobility five evenings."
      />

      <h2>When the real week doesn&rsquo;t match</h2>
      <p>
        It won&rsquo;t, every week: a trip, a deadline, a cold. Don&rsquo;t abandon the ideal week and don&rsquo;t redraw it by hand.
        Change the inputs for this week (one session fewer, a different day) and let it be placed again. Once the week is over, go back to
        the default. The ideal week is the baseline you return to, not a test you pass or fail.
      </p>

      <h2>Weekly schedule ideas worth stealing</h2>
      <ul>
        <li>
          <strong>A meeting-free morning.</strong> One or more mornings a week nobody can book.
        </li>
        <li>
          <strong>Batch the shallow work.</strong> Email and admin once a day, at the end, instead of all day long.
        </li>
        <li>
          <strong>A weekly review slot.</strong> Half an hour on Friday afternoon to look back and adjust next week.
        </li>
        <li>
          <strong>A fixed end to the day.</strong> Reading or a walk at the same time every evening makes the bedtime realistic.
        </li>
        <li>
          <strong>Travel time as part of the activity.</strong> The gym is not one hour; it&rsquo;s one hour plus getting there and back.
        </li>
        <li>
          <strong>One truly free evening.</strong> Planned as free, so it stays free.
        </li>
      </ul>
      <p>
        Want a head start? The machine comes with ready-made weeks (student, founder, 9-to-5, training, exam revision, deep work) to load
        and change until the week is yours.
      </p>

      <TryIt>
        Robot Mode is built for exactly this: write your ideal week once, as a few lines, and it places every session around your sleep and
        meals. Print it, follow it, and change only what a particular week needs.
      </TryIt>
    </Article>
  )
}
