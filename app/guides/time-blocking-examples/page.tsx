import { Article, ExampleWeek, TryIt, Typed, guideMetadata } from "@/components/Article"
import { guideBySlug } from "@/lib/guides"

const guide = guideBySlug("time-blocking-examples")
export const metadata = guideMetadata(guide)

export default function TimeBlockingExamples() {
  return (
    <Article guide={guide}>
      <p>
        Time blocking means giving every important activity its own block on the calendar: a start, an end, and nothing else allowed inside.
        Instead of a list of things to get to, you get a week where each thing already has its place. It works for the same reason an
        appointment works. You don&rsquo;t decide whether to go to the dentist that morning; it&rsquo;s at 10:00, so you go.
      </p>
      <p>
        Definitions are easy to find. Complete examples are not, so here are three whole weeks, blocked, with the reasoning behind each, and
        then the mistakes that make blocked weeks collapse.
      </p>

      <h2>Example 1: a deep work week</h2>
      <p>
        For anyone whose best work needs long, uninterrupted stretches: writing, programming, design, research. The idea is to put the deep
        work on the calendar before anything shallow can claim the time.
      </p>
      <ExampleWeek
        templateId="deep-work"
        caption="Two deep work blocks every weekday (three hours, then two), email batched once a day, a walk at midday and reading every night."
      />
      <ul>
        <li>
          <strong>The long block comes first,</strong> inside 08:00–12:00, before messages and meetings arrive.
        </li>
        <li>
          <strong>The second block is shorter.</strong> Two hours in the afternoon. Around four or five hours of truly focused work a day is
          as much as most people sustain.
        </li>
        <li>
          <strong>Email gets one block,</strong> late in the afternoon. Answered daily, never in the middle of a focus block.
        </li>
        <li>
          <strong>The walk is scheduled.</strong> A real break between the blocks makes the second one possible.
        </li>
      </ul>

      <h2>Example 2: a 9-to-5 with a life around it</h2>
      <p>
        If your working hours are fixed, time blocking isn&rsquo;t about the job, it&rsquo;s about the hours around it. Without blocks,
        evenings dissolve; with them, training and reading actually happen.
      </p>
      <ExampleWeek
        templateId="worker"
        caption="Work in two four-hour blocks around a full lunch, the gym three evenings before dinner with travel time, reading five nights a week."
      />
      <p>
        Notice what isn&rsquo;t blocked: the weekend. Blocking every hour of a week is the fastest way to abandon it. Leave room on purpose.
      </p>

      <h2>Example 3: time blocking for students</h2>
      <p>
        Students have the opposite problem from office workers: a few fixed hours (lectures) and a great deal of soft time that slips. The
        fix is to block study right after the fixed hours, every day, while the material is fresh.
      </p>
      <ExampleWeek
        templateId="exam"
        caption="Exam season: two hours of deep revision every morning, two of practice questions every afternoon, a daily walk and flashcards before bed."
      />
      <p>
        Outside exam season, the same shape works with lighter blocks: ninety minutes of study a day after classes, and the gym on a few
        evenings. Your classes move every term, so write the blocks as lines and let the week be placed around this term&rsquo;s timetable.
      </p>

      <h2>The mistakes that make blocks collapse</h2>
      <ol>
        <li>
          <strong>Blocks that are too small.</strong> Thirty-minute blocks of everything turn a week into a train timetable. Fewer, longer
          blocks survive contact with reality.
        </li>
        <li>
          <strong>No travel or transition time.</strong> A gym block that starts the minute work ends will run late every single time. Keep
          fifteen minutes either side for anything you have to get to.
        </li>
        <li>
          <strong>Forgetting the fixed costs.</strong> Meals, commuting and sleep are blocks too. Leave them out and the plan only fits on
          paper.
        </li>
        <li>
          <strong>Blocking 100% of the week.</strong> Unplanned time isn&rsquo;t wasted; it&rsquo;s what absorbs the unexpected.
        </li>
        <li>
          <strong>Ignoring your energy.</strong> Hard work in your best hours, routine work in your worst. A block in the wrong part of the
          day is a block you will skip.
        </li>
        <li>
          <strong>Rebuilding the blocks every day.</strong> Time blocking pays off when the week is decided once. Redrawing it every morning
          brings back the very decisions it was meant to remove.
        </li>
      </ol>

      <h2>Daily or weekly time blocking?</h2>
      <p>
        Daily blocking (planning tomorrow every evening) gives you control over each day but costs a planning session every day, and the
        same decisions keep coming back. Weekly blocking decides the shape of the week once: which days you train, when deep work happens,
        when you read. You then only adjust it at a weekly review. For recurring activities, weekly is the better default; daily planning is
        for what goes <em>inside</em> the blocks.
      </p>

      <h2>A blocked week without dragging boxes</h2>
      <p>
        Most time blocking templates are empty grids: you draw every box yourself, then redraw them when something changes. There is another
        way. Describe what each block needs and let a scheduler place them all at once:
      </p>
      <Typed>deep work 3h 5x weekdays morning</Typed>
      <Typed>gym 1h 3x evening</Typed>
      <Typed>reading 45m daily</Typed>
      <p>
        Robot Mode places every session around your sleep and meals, keeps travel time, never overlaps two blocks, and re-places the whole week
        when you change one line. Move a block that matters, lock it, and the rest arranges itself around it:
      </p>
      <Typed>move gym mon to tue</Typed>

      <TryIt>
        Start from one of these weeks or write your own: Robot Mode places every block, nothing overlapping, and prints the week, with a
        ticket for today.
      </TryIt>
    </Article>
  )
}
