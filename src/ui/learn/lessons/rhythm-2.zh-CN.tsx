import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  CompoundTime,
  RhythmLine,
  RhythmRows,
  RhythmTap,
  ValueCard,
  type Beat,
} from '../rhythmFigures.tsx';

const h: Beat = { duration: 'half' };
const q: Beat = { duration: 'quarter' };
const e: Beat = { duration: 'eighth' };
const s: Beat = { duration: 'sixteenth' };
const t: Beat = { duration: 'eighth', triplet: true };
const hd: Beat = { duration: 'half', dotted: true };
const qd: Beat = { duration: 'quarter', dotted: true };
const ed: Beat = { duration: 'eighth', dotted: true };
const qT: Beat = { duration: 'quarter', tie: true };
const eT: Beat = { duration: 'eighth', tie: true };
const sr: Beat = { duration: 'sixteenth', rest: true };
const qdr: Beat = { duration: 'quarter', dotted: true, rest: true };

const HOW_LONG = '它持续几拍？';
const WHICH_COUNT = '标了颜色的音弹在哪一个数上？';

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'dotted-quarter',
    question: HOW_LONG,
    figure: <ValueCard beat={qd} label="附点四分音符" />,
    options: ['¾', '1', '1½', '2'],
    answer: 2,
  },
  {
    id: 'sixteenth',
    question: HOW_LONG,
    figure: <ValueCard beat={s} label="十六分音符" />,
    options: ['¼', '½', '¾', '1'],
    answer: 0,
  },
  {
    id: 'sixteenth-rest',
    question: HOW_LONG,
    figure: <ValueCard beat={sr} label="十六分休止符" />,
    options: ['¼', '½', '¾', '1'],
    answer: 0,
  },
  {
    id: 'dotted-eighth',
    question: HOW_LONG,
    figure: <ValueCard beat={ed} label="附点八分音符" />,
    options: ['¼', '½', '¾', '1'],
    answer: 2,
  },
  {
    id: 'e-s-s',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[e, s, s, q]}
        time={[2, 4]}
        counts={false}
        current={2}
        label="前八后十六和一个四分音符，第二个十六分音符标了颜色"
      />
    ),
    options: ['1', 'e', '&', 'a'],
    answer: 3,
  },
  {
    id: 'triplet',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[t, t, t, q]}
        time={[2, 4]}
        counts={false}
        current={2}
        label="一组三连音和一个四分音符，三连音的第三个音标了颜色"
      />
    ),
    options: ['1', '连', '音', '2'],
    answer: 2,
  },
  {
    id: 'syncopation',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[e, q, e]}
        time={[2, 4]}
        counts={false}
        current={1}
        label="八分、四分、八分，四分音符标了颜色"
      />
    ),
    options: ['1', '1 &', '2', '2 &'],
    answer: 1,
  },
  {
    id: 'six-eight',
    question: '6/8 拍的一小节有几拍？',
    figure: (
      <RhythmLine
        rhythm={[e, e, e, e, e, e]}
        time={[6, 8]}
        counts={false}
        label="6/8 拍的一小节，六个八分音符"
      />
    ),
    options: ['2', '3', '6'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        上一课的节奏只用到整拍和半拍。真正的音乐会把一拍分得更细，会把音延续过拍子，有时还故意和拍子错开。这一课补上读懂大多数初级曲目节奏所需要的东西。
      </p>

      <Section id="dotted" title="再说附点">
        <p>
          附点让音符再延长一半。附点二分音符你已经见过：2 + 1 = 3 拍。
          <strong>附点四分音符</strong>也是一样：1 + ½ = 1½ 拍。
        </p>
        <p>
          它后面几乎总是跟着一个八分音符，把第二拍剩下的一半补满。数作「1 (2) & 3」：在 1 上弹，2
          的时候继续按住，到 2 后面的「嗒」再弹下一个音。这里节奏下面带括号的数，是要数但不弹的。
        </p>
        <Plate
          wide
          caption="附点四分音符一直延续过第 2 拍，八分音符落在它后面的「嗒」上。先听，再跟着数。"
        >
          <RhythmRows
            bracket
            rows={[
              { title: '附点二分音符、四分音符', rhythm: [hd, q] },
              { title: '附点四分音符、八分音符，两遍', rhythm: [qd, e, qd, e] },
              { title: '附点四分音符、八分音符、二分音符', rhythm: [qd, e, h] },
            ]}
          />
        </Plate>
        <Aside title="按住，别空等">
          <p>最常见的毛病是提早松手，然后空等。带括号的那一拍要一直按着键，让声音连到八分音符。</p>
        </Aside>
      </Section>

      <Section id="ties" title="延音线">
        <p>
          <strong>延音线</strong>
          是连接两个同音高音符的弧线。弹第一个，然后按住，时值是两个加起来那么长；第二个不再重新弹。
        </p>
        <p>
          延音线能做到附点做不到的事：把音延续过拍子，甚至越过小节线，这些地方一个音符写不下。四分音符用延音线连上一个八分音符，听起来和附点四分音符完全一样。
        </p>
        <Plate
          wide
          caption="连在一起的两个音只是一个声音。第二行和附点四分加八分听起来一样；最后一行是 3/4 拍，第 3 拍延续过小节线。"
        >
          <RhythmRows
            bracket
            rows={[
              { title: '两个四分音符连起来', rhythm: [q, qT, q, q] },
              { title: '四分音符连八分音符', rhythm: [qT, e, e, h] },
              { title: '越过小节线', rhythm: [q, q, qT, q, h], time: [3, 4] },
            ]}
          />
        </Plate>
        <Aside title="延音线还是圆滑线？">
          <p>
            <strong>圆滑线</strong>
            长得和延音线很像，但连的是不同音高的音，意思是连贯地弹，一个音接着一个音。延音线只连同一个音。
          </p>
        </Aside>
      </Section>

      <Section id="sixteenths" title="十六分音符">
        <p>
          <strong>十六分音符</strong>
          有两个符尾，或者两道符杠。它是四分之一拍：四个合起来是一拍。数作「1 e &
          a」，念「一、伊、嗒、啊」。十六分休止符有两个小钩，比八分休止符多一个。
        </p>
        <p>
          十六分音符常常和八分音符合在一拍里。一个八分加两个十六分叫<strong>前八后十六</strong>
          ，数「1 & a」；两个十六分加一个八分叫<strong>前十六后八</strong>，数「1 e &」。
          <strong>附点八分音符</strong>占三个十六分，所以后面那个十六分落在「a」上，紧贴着下一拍。
        </p>
        <Plate
          wide
          caption="每一行是一小节 2/4 拍。第二道符杠标出十六分音符；短短的一截指向它所属的那个音。"
        >
          <RhythmRows
            bracket
            bpm={60}
            rows={[
              { title: '一个四分，再四个十六分', rhythm: [q, s, s, s, s], time: [2, 4] },
              { title: '前八后十六', rhythm: [e, s, s, e, s, s], time: [2, 4] },
              { title: '前十六后八', rhythm: [s, s, e, s, s, e], time: [2, 4] },
              { title: '附点八分、十六分', rhythm: [ed, s, ed, s], time: [2, 4] },
            ]}
          />
        </Plate>
        <Aside title="短的要短">
          <p>
            附点八分加十六分很容易弹得松垮，两个音差不多一样长。附点八分要按满三个十六分，十六分晚一点弹，紧贴着下一拍。
          </p>
        </Aside>
      </Section>

      <Section id="triplets" title="三连音">
        <p>
          有时一拍不是分成两份，而是三份。上面标着 3 的三个八分音符就是<strong>三连音</strong>
          ：在两个音的时间里弹三个音。三个音一样长，各占三分之一拍。
        </p>
        <p>
          念作「1 连 音、2 连
          音」：把「三连音」三个字均匀地念满一拍，只是第一个字换成拍数。仔细听两者的区别：普通的八分音符像齐步走，三连音像在滚动。
        </p>
        <Plate
          wide
          caption="同样的拍子，先分成两份，再分成三份，然后两种轮流。上下几行的拍子是对齐的。"
        >
          <RhythmRows
            bracket
            spacing={88}
            rows={[
              { title: '八分音符：一拍两个', rhythm: [e, e, e, e], time: [2, 4] },
              { title: '三连音：一拍三个', rhythm: [t, t, t, t, t, t], time: [2, 4] },
              { title: '先两个，再三个', rhythm: [e, e, t, t, t], time: [2, 4] },
            ]}
          />
        </Plate>
        <Aside title="三个一样长">
          <p>
            三连音不是两个快的加一个慢的。跟着节拍声，每个数字上一下，均匀地念「1 连
            音」，让三个音正好填满一拍。
          </p>
        </Aside>
      </Section>

      <Section id="syncopation" title="切分音">
        <p>
          重要的音一般从拍子上开始。<strong>切分音</strong>
          把它挪开：一个较长的音从两拍之间开始，重音就落在你意想不到的地方。拉格泰姆、爵士和很多流行音乐里到处都是。
        </p>
        <p>
          最常见的是八分、四分、八分：四分音符从第 1 拍的「嗒」开始，一直延续过第 2
          拍。用延音线把音连过拍子，效果也一样。两种写法在第 2
          拍上都不重新弹，拍子却照样在底下走着。
        </p>
        <Plate wide caption="带括号的数，是那一拍上什么都不弹：前一个音一直延续过去。">
          <RhythmRows
            bracket
            rows={[
              { title: '八分、四分、八分', rhythm: [e, q, e, e, q, e] },
              { title: '用延音线连过拍子', rhythm: [e, eT, e, e, q, q] },
              { title: '整小节都在拍子之间', rhythm: [e, q, q, q, e] },
            ]}
          />
        </Plate>
        <Aside title="数出声来">
          <p>切分音最需要数拍。每个数都念出来，带括号的也念，只在有音符的地方弹。</p>
        </Aside>
      </Section>

      <Section id="six-eight" title="6/8 拍">
        <p>
          <strong>6/8 拍</strong>
          每小节六个八分音符，但不是六拍。它的感觉是两拍，每拍三个八分音符：「1 2 3 4 5 6」，重音在
          1 和
          4。一拍是一个附点四分音符，正好三个八分音符那么长；八分音符三个一组连在一起，就是为了让你看出拍子。
        </p>
        <p>
          3/4 拍每小节也是六个八分音符，只是两个一组：三拍，每拍两个八分。音符一样，拍子不同：3/4
          拍像圆舞曲一样数三拍，6/8 拍像船歌或摇篮曲一样两拍一晃。
        </p>
        <Plate caption="每小节六个八分音符，两种分组、两种打拍子的方式。在 3/4 和 6/8 之间切换，听拍子落在哪里；加上八分音符的节拍声，听它们怎么分组。">
          <CompoundTime labels={{ clicks: '节拍声', beats: '只打拍子', eighths: '加上八分音符' }} />
        </Plate>
        <p>
          四分加八分是 6/8
          拍里一长一短的摇晃感：四分音符占两个八分，八分音符占第三个。附点四分音符占满一整拍。
        </p>
        <Plate wide caption="6/8 拍里八分音符也会响，比拍子轻一些，好让你把六个都数出来。">
          <RhythmRows
            bracket
            rows={[
              { title: '四分、八分', rhythm: [q, e, q, e], time: [6, 8] },
              { title: '三个八分、附点四分', rhythm: [e, e, e, qd], time: [6, 8] },
              {
                title: '附点四分音符和附点四分休止符',
                rhythm: [qd, qd, e, e, e, qdr],
                time: [6, 8],
              },
            ]}
          />
        </Plate>
      </Section>

      <Section id="try-it" title="试一试">
        <p>先说出新学的音符有多长、落在哪个数上，再跟着拍子把节奏打出来。</p>
        <Plate>
          <ChoiceQuiz prompt="读一读这个节奏。" questions={QUESTIONS} />
        </Plate>
        <Plate wide>
          <RhythmTap
            bracket
            bpm={60}
            prompt="边数拍子，边在每个音符上随便按一个键。"
            rhythms={[
              [qd, e, q, q],
              [q, qT, e, e, q],
              [e, s, s, e, s, s, q, q],
              [ed, s, ed, s, h],
              [t, t, t, q, t, t, t, q],
              [e, q, e, q, q],
              { rhythm: [q, e, q, e], time: [6, 8] },
            ]}
            onComplete={complete}
          />
        </Plate>
        <p>
          「曲目」里的节奏模式会用同样的方法给真实乐曲的每个音计时。新节奏怎么也弹不顺的时候，把「节拍器」调慢，让它每拍响两下、三下或四下；它也能打
          6/8 拍。
        </p>
      </Section>
    </>
  );
}
