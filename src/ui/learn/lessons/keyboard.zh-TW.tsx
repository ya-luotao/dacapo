import { isBlack, pitchClass } from '../../../core/note.ts';
import { KeyQuiz } from '../exercises.tsx';
import { BlackGroups, FindKeys, LetterKeys, NameAnyKey } from '../keyboardFigures.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { keyName, useCompleteLesson } from '../lesson.ts';

const THREE_OCTAVES: readonly [number, number] = [48, 83]; // C3–B5

const twoGroup = (midi: number) =>
  isBlack(midi) && pitchClass(midi) <= 3 ? `two${Math.floor(midi / 12)}` : null;
const isC = (midi: number) => (pitchClass(midi) === 0 ? `${midi}` : null);
const isF = (midi: number) => (pitchClass(midi) === 5 ? `${midi}` : null);

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        鋼琴鍵盤看起來像一整排八十八個鍵，其實不然：它只是一個十二個鍵的小圖案，從最低音一直重複到最高音。認熟了這個圖案，找任何一個鍵都不必再數。
      </p>
      <Picture
        src="learn/seated-at-middle-c.webp"
        alt="從背後看一位彈琴的人，她坐在直立式鋼琴的正中間，雙手分別放在鍵盤中線的兩側。"
        caption="坐在鍵盤的正中間，面對中央 C：琴椅擺正，背挺直，前臂與琴鍵大致齊平。"
      />

      <Section id="twos-and-threes" title="兩個一組，三個一組">
        <p>
          先看黑鍵。它們並不是平均排列的，而是<strong>兩個一組</strong>、<strong>三個一組</strong>
          ，一組接一組，從頭排到尾。這個規律就是你的地圖：每個白鍵叫什麼，都看它靠著哪一組黑鍵。
        </p>
        <Plate
          wide
          caption="黑鍵兩個一組（藍色）、三個一組（琥珀色）。顏色只是標出規律，每個鍵照樣可以彈。"
        >
          <BlackGroups labels={{ two: '兩個一組', three: '三個一組', both: '都顯示' }} />
        </Plate>
        <p>換你了：找出這段鍵盤上所有「兩個一組」的黑鍵。每組彈其中一個就好。</p>
        <Plate>
          <FindKeys
            range={THREE_OCTAVES}
            groupOf={twoGroup}
            prompt="每一組「兩個一組」的黑鍵，各彈一個。"
          />
        </Plate>
        <Aside title="用手去摸">
          <p>
            在真的鋼琴上，不看也找得到這些組：手指沿著黑鍵滑過去，每過兩個、三個黑鍵，就會摸到一段比較寬的空隙。
          </p>
        </Aside>
      </Section>

      <Section id="seven-letters" title="七個字母">
        <p>
          白鍵用英文字母的前七個命名，從 A 到 G，G 之後又回到 A。不過音樂裡習慣從 C
          數起，我們也這樣：
          <strong>C D E F G A B</strong>，然後又是 C。
        </p>
        <p>只要記住兩個地標，其餘的都推得出來：</p>
        <ul>
          <li>
            <strong>C</strong>：緊鄰「兩個一組」黑鍵左邊的白鍵。
          </li>
          <li>
            <strong>F</strong>：緊鄰「三個一組」黑鍵左邊的白鍵。
          </li>
        </ul>
        <p>
          從 C 往上照字母走：D 在兩個黑鍵中間，E 在它們右邊。從 F 往上：G 和 A 夾在三個黑鍵之間，B
          在它們右邊。
        </p>
        <Plate caption="C 靠著兩個一組的黑鍵，F 靠著三個一組的黑鍵，其餘五個依序排下去。">
          <LetterKeys labels={{ c: 'C', f: 'F', all: '七個全部顯示' }} />
        </Plate>
        <Plate>
          <FindKeys range={THREE_OCTAVES} groupOf={isC} prompt="彈出這段鍵盤上所有的 C。" />
        </Plate>
        <Plate>
          <FindKeys range={THREE_OCTAVES} groupOf={isF} prompt="再彈出所有的 F。" />
        </Plate>
      </Section>

      <Section id="middle-c" title="中央 C 與八度">
        <p>
          從一個 C 到下一個 C 叫一個<strong>八度</strong>：連兩頭的 C 算在內是八個白鍵。不算上面那個
          C，連黑鍵一共十二個鍵，這就是那個不斷重複的圖案。名字也跟著圖案重複，所以為了區分這些
          C，每個八度都有一個編號。
        </p>
        <p>
          離鋼琴正中央最近的那個 C 是 <strong>C4</strong>，叫作<strong>中央 C</strong>
          。從它往上直到下一個 B，都屬於第 4 八度：D4、E4⋯⋯一直到 B4。再往上的 C 開始第 5 八度，是
          C5。往下，中央 C 左邊緊鄰的 B 是 B3。
        </p>
        <p>
          中央 C 就是你的大本營。面對它坐好，它正好是兩隻手的分界：右手通常從中央 C
          往上彈，左手在它下面。
        </p>
        <Plate
          wide
          caption="完整的 88 個鍵，每個 C 都標了名字。隨便彈一個鍵，看看它叫什麼，以及同一個字母在其他八度的位置。"
        >
          <NameAnyKey />
        </Plate>
        <Aside title="鍵盤比較小的話">
          <p>
            一台完整的鋼琴從 A0 到 C8。很多電子鍵盤只有 61 鍵或 49 鍵，中央 C 仍然是
            C4，只是離左端比較近。不確定的話，彈一下你認為是中央 C 的鍵，在上面看看它的名字。
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="試一試：照名字找鍵">
        <p>
          現在把學到的串起來。每一題給出一個鍵的名字和八度。靠黑鍵的分組和八度去找，不要從頭數。
        </p>
        <Plate>
          <KeyQuiz
            range={THREE_OCTAVES}
            items={[60, 62, 64, 67, 57, 53, 72, 71, 55, 65].map((key) => ({
              key,
              ask: `彈出 ${keyName(key)}`,
            }))}
            onComplete={complete}
          />
        </Plate>
        <p>
          這就是整個鍵盤：一個圖案、七個字母，再加上八度的編號。下一課講五線譜：寫在五條線上的一個音符，怎麼告訴你該彈哪個鍵。
        </p>
      </Section>
    </>
  );
}
