import { ChoiceQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { StaffQuiz, type Card } from '../staffFigures.tsx';
import { IntervalCard, IntervalExplorer, LandmarkMap } from '../theoryFigures.tsx';

const LANDMARK_CARDS: readonly Card[] = [
  { pitch: 'G4', clef: 'treble' },
  { pitch: 'F3', clef: 'bass' },
  { pitch: 'C5', clef: 'treble' },
  { pitch: 'C4', clef: 'bass' },
  { pitch: 'C3', clef: 'bass' },
  { pitch: 'C6', clef: 'treble' },
  { pitch: 'C4', clef: 'treble' },
  { pitch: 'C2', clef: 'bass' },
];

const NEIGHBOUR_CARDS: readonly Card[] = [
  { pitch: 'D4', clef: 'treble' },
  { pitch: 'B4', clef: 'treble' },
  { pitch: 'E3', clef: 'bass' },
  { pitch: 'A4', clef: 'treble' },
  { pitch: 'G3', clef: 'bass' },
  { pitch: 'D5', clef: 'treble' },
  { pitch: 'B2', clef: 'bass' },
  { pitch: 'E4', clef: 'treble' },
];

const OPTIONS = ['二度', '三度', '四度', '五度', '八度'];
const PAIRS: readonly [string, string, number][] = [
  ['E4', 'F4', 0],
  ['G4', 'B4', 1],
  ['C4', 'G4', 3],
  ['A4', 'B4', 0],
  ['D4', 'F4', 1],
  ['E4', 'A4', 2],
  ['F4', 'C5', 3],
  ['C4', 'C5', 4],
];
const MIDI: Record<string, number> = {
  C4: 60,
  D4: 62,
  E4: 64,
  F4: 65,
  G4: 67,
  A4: 69,
  B4: 71,
  C5: 72,
};

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        每次都從譜表最下面一條線數起，不但慢，也永遠快不起來。讀譜熟練的人換了個辦法：他們一眼就認得少數幾個音，其餘的音都看成離最近那個音「走一步」或「跳一格」。
      </p>

      <Section id="landmarks" title="一眼就認得的幾個音">
        <p>這幾個音就是地標音。把它們練到不用想：</p>
        <ul>
          <li>
            <strong>中央 C</strong>（C4）：兩行譜表之間的那條加線。
          </li>
          <li>
            <strong>高音譜表的 G</strong>（G4）：高音譜號繞著的那條線。
          </li>
          <li>
            <strong>低音譜表的 F</strong>（F3）：低音譜號兩個點中間的那條線。
          </li>
          <li>
            <strong>高音譜表的 C</strong>（C5）：高音譜表的第三間；<strong>低音譜表的 C</strong>
            （C3）：低音譜表的第二間。
          </li>
          <li>
            <strong>高音 C</strong>（C6）：高音譜表上方第二條加線；<strong>低音 C</strong>
            （C2）：低音譜表下方第二條加線。
          </li>
        </ul>
        <Plate
          wide
          caption="七個地標音。點一個，聽聽它的聲音、看看它的鍵：五個 C 從 C2 到 C6，每個相隔一個八度。"
        >
          <LandmarkMap label="大譜表上的地標音" />
        </Plate>
        <Aside title="一對鏡像">
          <p>
            高音譜表的 C 和低音譜表的 C 離中央 C 一樣遠，一個在上，一個在下。從中央 C
            這一側往外數間，它們都是各自譜表的第三間：高音譜表從下往上數，低音譜表從上往下數。把它們當成一對來記。
          </p>
        </Aside>
      </Section>

      <Section id="intervals" title="走一步，跳一格">
        <p>
          兩個音之間的距離叫<strong>音程</strong>，照字母數，兩頭都算在內：C 到 D 是二度，C 到 E
          是三度，C 到 G 是五度，C 到下一個 C 是八度。
        </p>
        <p>在譜上，音程有看得見的形狀，不必先說出音名：</p>
        <ul>
          <li>
            <strong>二度</strong>就是<strong>走一步</strong>
            ：從線到緊鄰的間，或從間到緊鄰的線。在鍵盤上就是隔壁的白鍵。
          </li>
          <li>
            <strong>三度</strong>就是<strong>跳一格</strong>
            ：從線到下一條線，或從間到下一個間。中間隔一個白鍵。
          </li>
          <li>
            奇數的音程（三度、五度）維持同一種：線到線、間到間。偶數的音程（二度、四度、八度）會換一種：線到間。
          </li>
        </ul>
        <Plate caption="選一個音程，聽聽看。點「換一個」，兩個音一起移動，形狀不變。">
          <IntervalExplorer
            staffLabel="高音譜表上的兩個音"
            labels={{ 2: '二度', 3: '三度', 4: '四度', 5: '五度', 8: '八度' }}
            shapes={{
              2: '走一步：線到間',
              3: '跳一格：線到線，或間到間',
              4: '走三步：線到間',
              5: '走四步：線到線，或間到間',
              8: '同一個字母，往上八個音',
            }}
          />
        </Plate>
      </Section>

      <Section id="from-a-landmark" title="從地標音出發讀譜">
        <p>
          現在把兩者合起來。遇到沒辦法一眼認出的音，先找離它最近的地標音，再數幾步：中央 C
          往上走一步是 D4，高音譜表的 G 往上跳一格是 B4，低音譜表的 F 往下走一步是 E3。
        </p>
        <p>一開始會覺得慢。一兩個星期之後，這些中間的音也會變成新的地標，你就不用再數了。</p>
      </Section>

      <Section id="try-it" title="試一試">
        <p>先認地標音本身，再照形狀認音程，最後讀地標旁邊的音。</p>
        <Plate>
          <StaffQuiz cards={LANDMARK_CARDS} ask="彈出譜上的地標音。" />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="這是幾度？"
            questions={PAIRS.map(([low, high, answer]) => ({
              id: `${low}${high}`,
              figure: <IntervalCard low={low} high={high} label={`${low} 和 ${high}`} />,
              options: OPTIONS,
              answer,
              sound: [MIDI[low]!, MIDI[high]!],
            }))}
          />
        </Plate>
        <Plate>
          <StaffQuiz
            cards={NEIGHBOUR_CARDS}
            ask="找到最近的地標音，數一數走幾步，再彈出這個音。"
            onComplete={complete}
          />
        </Plate>
        <p>
          識譜練習練的正是這個，一次一個音：它的等級從中央 C
          向外擴展，而且會反覆出你找得最慢的那些音。
        </p>
      </Section>
    </>
  );
}
