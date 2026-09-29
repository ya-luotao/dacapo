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
        每次都从谱表最下面一条线数起，既慢，也永远快不起来。读谱熟练的人换了个办法：他们一眼就认得少数几个音，其余的音都看成离最近那个音「走一步」或「跳一格」。
      </p>

      <Section id="landmarks" title="一眼就认得的几个音">
        <p>这几个音就是地标音。把它们练到不用想：</p>
        <ul>
          <li>
            <strong>中央 C</strong>（C4）：两行谱表之间的那条加线。
          </li>
          <li>
            <strong>高音谱表的 G</strong>（G4）：高音谱号绕着的那条线。
          </li>
          <li>
            <strong>低音谱表的 F</strong>（F3）：低音谱号两个点中间的那条线。
          </li>
          <li>
            <strong>高音谱表的 C</strong>（C5）：高音谱表的第三间；<strong>低音谱表的 C</strong>
            （C3）：低音谱表的第二间。
          </li>
          <li>
            <strong>高音 C</strong>（C6）：高音谱表上方第二条加线；<strong>低音 C</strong>
            （C2）：低音谱表下方第二条加线。
          </li>
        </ul>
        <Plate
          wide
          caption="七个地标音。点一个，听听它的声音、看看它的键：五个 C 从 C2 到 C6，每个相隔一个八度。"
        >
          <LandmarkMap label="大谱表上的地标音" />
        </Plate>
        <Aside title="一对镜像">
          <p>
            高音谱表的 C 和低音谱表的 C 离中央 C 一样远，一个在上，一个在下。从中央 C
            这一侧往外数间，它们都是各自谱表的第三间：高音谱表从下往上数，低音谱表从上往下数。把它们当成一对来记。
          </p>
        </Aside>
      </Section>

      <Section id="intervals" title="走一步，跳一格">
        <p>
          两个音之间的距离叫<strong>音程</strong>，按字母数，两头都算在内：C 到 D 是二度，C 到 E
          是三度，C 到 G 是五度，C 到下一个 C 是八度。
        </p>
        <p>在谱上，音程有看得见的形状，不必先说出音名：</p>
        <ul>
          <li>
            <strong>二度</strong>就是<strong>走一步</strong>
            ：从线到紧挨着的间，或从间到紧挨着的线。在键盘上就是隔壁的白键。
          </li>
          <li>
            <strong>三度</strong>就是<strong>跳一格</strong>
            ：从线到下一条线，或从间到下一个间。中间隔一个白键。
          </li>
          <li>
            单数的音程（三度、五度）保持同一种：线到线、间到间。双数的音程（二度、四度、八度）会换一种：线到间。
          </li>
        </ul>
        <Plate caption="选一个音程，听一听。点「换一个」两个音一起移动，形状不变。">
          <IntervalExplorer
            staffLabel="高音谱表上的两个音"
            labels={{ 2: '二度', 3: '三度', 4: '四度', 5: '五度', 8: '八度' }}
            shapes={{
              2: '走一步：线到间',
              3: '跳一格：线到线，或间到间',
              4: '走三步：线到间',
              5: '走四步：线到线，或间到间',
              8: '同一个字母，往上八个音',
            }}
          />
        </Plate>
      </Section>

      <Section id="from-a-landmark" title="从地标音出发读谱">
        <p>
          现在把两者合起来。遇到不能一眼认出的音，先找离它最近的地标音，再数几步：中央 C
          往上走一步是 D4，高音谱表的 G 往上跳一格是 B4，低音谱表的 F 往下走一步是 E3。
        </p>
        <p>一开始会觉得慢。一两个星期之后，这些中间的音也会变成新的地标，你就不用再数了。</p>
      </Section>

      <Section id="try-it" title="试一试">
        <p>先认地标音本身，再按形状认音程，最后读地标旁边的音。</p>
        <Plate>
          <StaffQuiz cards={LANDMARK_CARDS} ask="弹出谱上的地标音。" />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="这是几度？"
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
            ask="找到最近的地标音，数一数几步，再弹出这个音。"
            onComplete={complete}
          />
        </Plate>
        <p>
          识谱练习练的正是这个，一次一个音：它的级别从中央 C
          向外扩展，并且会反复出你找得最慢的那些音。
        </p>
      </Section>
    </>
  );
}
