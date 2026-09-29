import { KeyQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { StaffQuiz, type Card } from '../staffFigures.tsx';
import { AccidentalExplorer, BarRule, SameKey, StepExplorer } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 83];

const STEPS: readonly { key: number; ask: string }[] = [
  { key: 65, ask: 'E4 往上半音' },
  { key: 62, ask: 'C4 往上全音' },
  { key: 59, ask: 'C4 往下半音' },
  { key: 66, ask: 'E4 往上全音' },
  { key: 70, ask: 'A4 往上半音' },
  { key: 60, ask: 'D4 往下全音' },
  { key: 64, ask: 'F4 往下半音' },
  { key: 61, ask: 'B3 往上全音' },
];

const CARDS: readonly Card[] = [
  { pitch: 'F#4', clef: 'treble' },
  { pitch: 'Bb3', clef: 'bass' },
  { pitch: 'C#4', clef: 'treble' },
  { pitch: 'Eb4', clef: 'treble' },
  { pitch: 'G#3', clef: 'bass' },
  { pitch: 'Bb4', clef: 'treble' },
  { pitch: 'F#3', clef: 'bass' },
  { pitch: 'Ab4', clef: 'treble' },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        到目前为止，每个音都是白键。黑键也有名字，而要给它们命名，得先认识音乐里最小的距离：半音。
      </p>

      <Section id="half-steps" title="半音与全音">
        <p>
          <strong>半音</strong>
          就是从一个键到紧挨着的下一个键，不管黑白，中间没有别的键。C 到 C♯ 是半音；E 到 F
          也是半音，因为它们之间没有黑键。
        </p>
        <p>
          <strong>全音</strong>等于两个半音：C 到 D，E 到 F♯。
        </p>
        <Plate caption="弹或点任意一个键：它两侧相隔半音（或全音）的键会标出来。">
          <StepExplorer />
        </Plate>
        <Aside title="两对白键半音">
          <p>
            E–F 和 B–C
            是仅有的两对中间没有黑键的相邻白键，也就是黑键分组断开的地方。除此之外，相邻的两个白键都相隔一个全音。
          </p>
        </Aside>
      </Section>

      <Section id="signs" title="升号、降号与还原号">
        <p>
          <strong>升号</strong> ♯ 把音升高半音：F♯ 就是 F 右边紧挨着的键。<strong>降号</strong> ♭
          把音降低半音：B♭ 就是 B 左边紧挨着的键。<strong>还原号</strong> ♮
          取消升降，回到原来的白键。
        </p>
        <p>
          谱上，记号写在音符前面，和音符在同一条线或同一个间上。读的时候说在后面：「升 F」，写作
          F♯。
        </p>
        <Plate caption="选一个记号，再点任意一条线或一个间来移动音符。音符留在原来的线上，琴键移动了半音。">
          <AccidentalExplorer
            staffLabel="带升号、还原号或降号的音符"
            labels={{ flat: '降号 ♭', natural: '还原号 ♮', sharp: '升号 ♯' }}
          />
        </Plate>
      </Section>

      <Section id="two-names" title="一个键，两个名字">
        <p>
          每个黑键都有两个名字。C 和 D 之间的那个键，既是 <strong>C♯</strong>（升 C），也是{' '}
          <strong>D♭</strong>（降 D）。谱上写哪一个取决于音乐本身，弹的都是同一个键。
        </p>
        <Plate caption="C♯ 和 D♭：一个键的两种写法。">
          <SameKey label="高音谱表上的升 C 和降 D" />
        </Plate>
      </Section>

      <Section id="to-the-barline" title="临时记号管到小节线">
        <p>
          写在乐曲中间的升号、降号、还原号叫<strong>临时记号</strong>
          。它对这个音一直有效，直到这一小节结束，后面同一个音即使不再写也照样算；小节线会让它失效。
        </p>
        <Plate caption="第二个 F 仍然是 F♯。过了小节线，F 又回到本来的 F。">
          <BarRule label="升 F、F，以及小节线后的 F" sounds="听一听" />
        </Plate>
      </Section>

      <Section id="try-it" title="试一试">
        <p>先在键盘上走半音和全音，再读谱上的升降号。</p>
        <Plate>
          <KeyQuiz range={RANGE} items={STEPS} />
        </Plate>
        <Plate>
          <StaffQuiz cards={CARDS} ask="弹出这个音，升降号也要算上。" onComplete={complete} />
        </Plate>
        <p>识谱练习的第 7 级「升号和降号」就会出这样的音，热力图还会告诉你哪些音找得最慢。</p>
      </Section>
    </>
  );
}
