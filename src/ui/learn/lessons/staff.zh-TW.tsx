import { Link } from 'wouter';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  ClefExplorer,
  GrandStaffLink,
  LinesAndSpaces,
  StaffQuiz,
  StepsUp,
  type Card,
} from '../staffFigures.tsx';

const CARDS: readonly Card[] = [
  { pitch: 'E4', clef: 'treble' },
  { pitch: 'A3', clef: 'bass' },
  { pitch: 'G4', clef: 'treble' },
  { pitch: 'F3', clef: 'bass' },
  { pitch: 'C4', clef: 'treble' },
  { pitch: 'B3', clef: 'bass' },
  { pitch: 'D4', clef: 'treble' },
  { pitch: 'C4', clef: 'bass' },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        樂譜上的每個音符都告訴你兩件事：它有多高，要持續多久。這一課講「多高」。鍵盤從左到右、由低到高；五線譜則從下到上、由低到高。
      </p>

      <Section id="lines-and-spaces" title="五條線，四個間">
        <p>
          <strong>五線譜</strong>
          由五條線和線與線之間的四個間組成。線和間都從下往上數：最下面一條是第一線，它上面的空隙是第一間。
        </p>
        <p>
          音符不是寫<strong>在線上</strong>，讓線從音符中間穿過；就是寫<strong>在間裡</strong>
          ，夾在兩條線之間。
        </p>
        <Plate caption="把滑鼠移到譜上（或者點一下），找出每一條線、每一個間。">
          <LinesAndSpaces
            staffLabel="五條線、四個間的五線譜"
            labels={{ lines: '線', spaces: '間' }}
          />
        </Plate>
      </Section>

      <Section id="steps" title="譜上往上走，鍵盤往右走">
        <p>
          從一條線到它上面緊鄰的間，或者從一個間到它上面緊鄰的線，就是照字母順序往上走一步，也就是往右移一個白鍵。線、間、線、間：C、D、E、F，依序往上。
        </p>
        <Plate caption="從 C4 到 C5，一次走一步。點「聽聽看」，或者點任何一條線、一個間來聽。">
          <StepsUp label="在高音譜表上從 C4 一步一步走到 C5 的八個音符" />
        </Plate>
      </Section>

      <Section id="treble-clef" title="高音譜號標出 G">
        <p>
          光有五條線，還不知道每條線是什麼音。寫在開頭的<strong>譜號</strong>會告訴你。
          <strong>高音譜號</strong>由字母 G 演變而來：它的圈繞著第二線，表示這條線上的音是
          G，也就是中央 C 上方的那個 G：
          <strong>G4</strong>。
        </p>
        <p>
          一條線有了名字，其他的線和間照著字母上下推就知道了。高音譜表的線從下往上是{' '}
          <strong>E G B D F</strong>，間從下往上是 <strong>F A C E</strong>。
        </p>
        <Plate caption="先看 G 線，再照字母看所有的線或所有的間。把滑鼠移到譜上任何位置，都能看到並聽到那裡的音。">
          <ClefExplorer
            clef="treble"
            staffLabel="高音譜表"
            labels={{ clef: 'G 線', lines: '線', spaces: '間' }}
          />
        </Plate>
        <Aside title="記憶法">
          <p>
            線從下往上：E、G、B、D、F，隔一個字母取一個；間從下往上連起來是 F-A-C-E，正好是英文單字
            face（臉）。
          </p>
        </Aside>
      </Section>

      <Section id="bass-clef" title="低音譜號標出 F">
        <p>
          較低的音用<strong>低音譜號</strong>來寫，它由字母 F
          演變而來。它的兩個點夾住第四線，表示這條線是 F，也就是中央 C 下方的那個 F：
          <strong>F3</strong>。
        </p>
        <p>
          低音譜表的線從下往上是 <strong>G B D F A</strong>，間是 <strong>A C E G</strong>。
        </p>
        <Plate caption="低音譜號也一樣：它的 F 線、所有的線和所有的間。">
          <ClefExplorer
            clef="bass"
            staffLabel="低音譜表"
            labels={{ clef: 'F 線', lines: '線', spaces: '間' }}
          />
        </Plate>
        <Aside title="注意">
          <p>
            同一條線在兩種譜號裡是不同的音：最下面一條線，在高音譜號裡是 E，在低音譜號裡是
            G。讀譜永遠先看譜號。
          </p>
        </Aside>
      </Section>

      <Section id="grand-staff" title="大譜表：在中央 C 相接">
        <p>
          鋼琴譜同時用兩行譜表，左邊用大括號連在一起，叫作<strong>大譜表</strong>
          。上面的高音譜表主要給右手，下面的低音譜表主要給左手。
        </p>
        <Picture
          src="learn/hands-either-side.webp"
          alt="兩隻手放在鋼琴鍵盤上，左手在中線左側，右手在中線右側，兩個大拇指靠得很近。"
          caption="右手在中央 C 以上，左手在中央 C 以下：大譜表的兩行譜，對應的就是兩隻手。"
        />
        <p>
          中央 C 正好在兩行譜表中間。它需要一條自己專用的短線，叫<strong>加線</strong>
          ，而且兩行譜上都能寫：寫在高音譜表下方，或者寫在低音譜表上方，都是同一個鍵。
        </p>
        <p>
          譜表上下放不下的音，都可以用加線往外延伸，數法和譜表本身的線一樣。高音譜表下方第一條加線上是
          C4，緊鄰在它下面的間裡是 B3。
        </p>
        <Plate
          wide
          caption="按住琴鍵，看看它們寫在哪裡：中央 C 和比它高的音寫在高音譜表，比它低的寫在低音譜表。"
        >
          <GrandStaffLink labels={{ play: '彈奏', middle: '中央 C', staff: '大譜表' }} />
        </Plate>
      </Section>

      <Section id="try-it" title="試一試：先讀，再彈">
        <p>
          兩種譜號各有幾個音，都在中央 C
          附近，一共八個。先看譜號，說出音名，再在正確的八度上彈出來。
        </p>
        <Plate>
          <StaffQuiz cards={CARDS} ask="彈出譜上的這個音。" onComplete={complete} />
        </Plate>
        <p>
          像這樣一個音一個音地讀，每天快一點，正是 dacapo 的<Link href="/read">識譜</Link>
          練習要訓練的。它的前幾個等級用的就是這次小測驗裡的音，而且會記住哪些音讓你慢下來。
        </p>
      </Section>
    </>
  );
}
