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
        到目前為止，每個音都是白鍵。黑鍵也有名字，而要替它們命名，得先認識音樂裡最小的距離：半音。
      </p>

      <Section id="half-steps" title="半音與全音">
        <p>
          <strong>半音</strong>
          就是從一個鍵到緊鄰的下一個鍵，不管黑白，中間沒有別的鍵。C 到 C♯ 是半音；E 到 F
          也是半音，因為它們之間沒有黑鍵。
        </p>
        <p>
          <strong>全音</strong>等於兩個半音：C 到 D，E 到 F♯。
        </p>
        <Plate caption="彈或點任何一個鍵：它兩側相隔半音（或全音）的鍵會標出來。">
          <StepExplorer />
        </Plate>
        <Aside title="兩對白鍵半音">
          <p>
            E–F 和 B–C
            是僅有的兩對中間沒有黑鍵的相鄰白鍵，也就是黑鍵分組斷開的地方。除此之外，相鄰的兩個白鍵都相隔一個全音。
          </p>
        </Aside>
      </Section>

      <Section id="signs" title="升記號、降記號與還原記號">
        <p>
          <strong>升記號</strong> ♯ 把音升高半音：F♯ 就是 F 右邊緊鄰的鍵。<strong>降記號</strong> ♭
          把音降低半音：B♭ 就是 B 左邊緊鄰的鍵。<strong>還原記號</strong> ♮
          取消升降，回到原來的白鍵。
        </p>
        <p>
          譜上，記號寫在音符前面，和音符在同一條線或同一個間上。寫成音名時，記號放在字母後面：F♯，唸作「升
          F」。
        </p>
        <Plate caption="選一個記號，再點任何一條線或一個間來移動音符。音符留在原來的線上，琴鍵移動了半音。">
          <AccidentalExplorer
            staffLabel="帶升記號、還原記號或降記號的音符"
            labels={{ flat: '降記號 ♭', natural: '還原記號 ♮', sharp: '升記號 ♯' }}
          />
        </Plate>
      </Section>

      <Section id="two-names" title="一個鍵，兩個名字">
        <p>
          每個黑鍵都有兩個名字。C 和 D 之間的那個鍵，既是 <strong>C♯</strong>（升 C），也是{' '}
          <strong>D♭</strong>（降 D）。譜上寫哪一個要看音樂本身，彈的都是同一個鍵。
        </p>
        <Plate caption="C♯ 和 D♭：一個鍵的兩種寫法。">
          <SameKey label="高音譜表上的升 C 和降 D" />
        </Plate>
      </Section>

      <Section id="to-the-barline" title="臨時記號管到小節線">
        <p>
          寫在樂曲中間的升記號、降記號、還原記號叫<strong>臨時記號</strong>
          。它對這個音一直有效，直到這一小節結束，後面同一個音即使不再寫也照樣算；過了小節線就失效。
        </p>
        <Plate caption="第二個 F 仍然是 F♯。過了小節線，F 又回到原本的 F。">
          <BarRule label="升 F、F，以及小節線後的 F" sounds="聽聽看" />
        </Plate>
      </Section>

      <Section id="try-it" title="試一試">
        <p>先在鍵盤上走半音和全音，再讀譜上的升降記號。</p>
        <Plate>
          <KeyQuiz range={RANGE} items={STEPS} />
        </Plate>
        <Plate>
          <StaffQuiz cards={CARDS} ask="彈出這個音，升降記號也要算進去。" onComplete={complete} />
        </Plate>
        <p>識譜練習的第 7 級「升降記號」就會出這樣的音，熱度圖還會告訴你哪些音找得最慢。</p>
      </Section>
    </>
  );
}
