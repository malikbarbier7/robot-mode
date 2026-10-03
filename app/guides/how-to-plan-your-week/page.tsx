import { Article, ExampleWeek, TryIt, Typed, guideMetadata } from "@/components/Article"
import { guideBySlug } from "@/lib/guides"

const guide = guideBySlug("how-to-plan-your-week")
export const metadata = guideMetadata(guide)

export default function HowToPlanYourWeek() {
  return (
    <Article guide={guide}>
      <p>
        Most people know what they want from a week. Train three or four times. Read more. Make progress on the side project. See friends.
        Sleep properly. The trouble is rarely the list. It is that the list never turns into a timetable, so every day starts with the same
        negotiation: <em>should I do it now, or later?</em> Later usually wins.
      </p>
      <p>
        Planning your week well means making those decisions once, on purpose, and then not making them again every morning. Here is a
        method that does exactly that, step by step.
      </p>

      <h2>Why weekly plans fall apart</h2>
      <ul>
        <li>
          <strong>It&rsquo;s a list, not a timetable.</strong> &ldquo;Gym 4×&rdquo; is a wish. &ldquo;Gym Monday, Tuesday, Thursday and
          Friday at 17:30&rdquo; is a plan.
        </li>
        <li>
          <strong>It ignores the fixed costs.</strong> Sleep, meals, commuting and getting to the gym take hours that never make it onto the
          list, so the plan only fits on paper.
        </li>
        <li>
          <strong>It gets renegotiated daily.</strong> A plan you rebuild every morning is not a plan; it&rsquo;s a mood forecast.
        </li>
      </ul>

      <h2>Step 1: write down what you want to do, not what you have to do</h2>
      <p>
        Start with the recurring things that make a week good, not with your to-do list. For each one, write three things: a name, how long
        a session lasts, and how many times a week. That&rsquo;s it.
      </p>
      <Typed>gym 1h15 4x</Typed>
      <Typed>reading 45m daily</Typed>
      <Typed>side project 2h 2x weekends</Typed>
      <p>
        Keep to-dos out of it. A weekly plan holds the <em>time</em> for things; what you do inside a work block can change every day. If
        it&rsquo;s a one-off with a deadline, it belongs in your task list, not in your week.
      </p>

      <h2>Step 2: fix the edges of the day first</h2>
      <p>
        Decide when you wake, when you sleep, and when you eat, before you place anything else. These are the walls of the week. With a
        07:00 wake-up and a 23:00 bedtime you have 16 waking hours a day, 112 a week. Take meals out and you might be left with about 100.
      </p>
      <p>
        Now add up what your list asks for. If it asks for more hours than the week has, you&rsquo;ve learned the most useful thing a plan
        can tell you, on Sunday instead of on Thursday. Cut something now: fewer sessions, shorter ones, or one activity less.
      </p>

      <h2>Step 3: give each activity a home</h2>
      <p>
        Some things belong at a certain time of day. Deep work goes where your attention is best, usually the morning. Training might only be
        possible after work. Reading works as the last thing before bed. Write those preferences down, along with anything that needs travel
        time around it, like getting to the gym and back.
      </p>
      <p>
        Don&rsquo;t over-specify. &ldquo;Evenings&rdquo; is better than &ldquo;19:15&rdquo;: the fewer fixed points, the easier everything
        fits.
      </p>

      <h2>Step 4: place everything at once</h2>
      <p>
        This is where most planning goes wrong. Placing activities one by one means the first ones get the best slots and the last ones get
        whatever is left, or nothing. Place the whole week together, so every session gets a slot that respects its preferences and nothing
        overlaps.
      </p>
      <p>
        By hand, that&rsquo;s a puzzle; with a scheduling tool, it takes a second. This is the week the student template comes out with:
        lectures in the mornings, study after lunch, the gym on four evenings with travel time kept, and reading every night.
      </p>
      <ExampleWeek templateId="student" caption="Four activities and three meals, placed by Robot Mode around an 08:00 wake-up and a midnight bedtime." />

      <h2>Step 5: put it on paper, then follow it</h2>
      <p>
        A plan you have to open an app to see is a plan you can avoid looking at. Print the week and keep it where you&rsquo;ll see it. In
        the morning, the only question left is &ldquo;what does the paper say?&rdquo;, and the answer is already written.
      </p>
      <p>
        Robot Mode prints the whole week and a ticket with just today&rsquo;s lines, small enough for a pocket or the corner of a desk.
      </p>

      <h2>Step 6: review once a week, not once a day</h2>
      <p>
        Pick one moment a week, Sunday evening or Friday afternoon, to look back and adjust. Did the gym slots work? Was the study block too
        long? Change the inputs, not the week by hand: one session fewer, a different window, an earlier wake-up. Then let the whole week be
        placed again around the change.
      </p>
      <p>
        If one session sits exactly right, keep it there and let everything else move around it:
      </p>
      <Typed>lock gym monday</Typed>

      <h2>Planning your week as a student</h2>
      <p>
        A student week has a fixed spine (lectures, labs, a job) and a lot of soft time around it, which is precisely why it slips. Put the
        fixed classes in first, then give every weekday a study block right after them, while the material is fresh. Ninety minutes is long
        enough to finish something and short enough to start. Keep at least one evening and most of one weekend day unplanned: a week with
        no slack breaks the first time a deadline moves.
      </p>
      <p>
        Your timetable changes every term, so don&rsquo;t copy someone else&rsquo;s week: write your own lines once, and change them when
        your classes change. The whole week is placed again around the new hours.
      </p>

      <h2>How to stick to the schedule</h2>
      <ul>
        <li>
          <strong>Make fewer decisions.</strong> The plan works because the deciding is done. When you catch yourself re-deciding,
          that&rsquo;s the moment to look at the paper instead.
        </li>
        <li>
          <strong>Protect the first block of the day.</strong> If the morning goes to plan, the rest usually follows.
        </li>
        <li>
          <strong>Don&rsquo;t compensate.</strong> Missed a session? Let it go. Doubling up tomorrow is how one bad day becomes a bad week.
        </li>
        <li>
          <strong>Change the plan only at the review.</strong> Mid-week changes are fine when life moves something; redesigning the week on
          Wednesday is not.
        </li>
      </ul>

      <TryIt>
        Robot Mode does steps 2 to 5 for you. Write what you want to do, set your hours and meals, and it places every session, nothing
        overlapping, ready to print. If you&rsquo;d rather not start from a blank page, open a template and change what doesn&rsquo;t fit.
      </TryIt>
    </Article>
  )
}
