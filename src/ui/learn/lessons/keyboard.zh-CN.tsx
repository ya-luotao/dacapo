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
        钢琴键盘看上去像一整排八十八个键，其实不然：它只是一个十二个键的小图案，从最低音一直重复到最高音。认准了这个图案，找任何一个键都不用再数。
      </p>
      <Picture
        src="learn/seated-at-middle-c.webp"
        alt="从背后看一位弹琴的人，她坐在立式钢琴的正中间，双手分别放在键盘中线的两侧。"
        caption="坐在键盘的正中间，面对中央 C：琴凳摆正，背挺直，小臂与琴键大致齐平。"
      />

      <Section id="twos-and-threes" title="两个一组，三个一组">
        <p>
          先看黑键。它们并不是均匀排列的，而是<strong>两个一组</strong>、<strong>三个一组</strong>
          ，一组接一组，从头排到尾。这个规律就是你的地图：每个白键叫什么，都看它挨着哪一组黑键。
        </p>
        <Plate
          wide
          caption="黑键两个一组（蓝色）、三个一组（琥珀色）。颜色只是标出规律，每个键照样可以弹。"
        >
          <BlackGroups labels={{ two: '两个一组', three: '三个一组', both: '都显示' }} />
        </Plate>
        <p>轮到你了：找出这段键盘上所有「两个一组」的黑键。每组弹其中一个就行。</p>
        <Plate>
          <FindKeys
            range={THREE_OCTAVES}
            groupOf={twoGroup}
            prompt="每一组「两个一组」的黑键，各弹一个。"
          />
        </Plate>
        <Aside title="用手去摸">
          <p>
            在真钢琴上，不看也能找到这些组：手指沿着黑键滑过去，每过两个、三个黑键，就会摸到一段更宽的空隙。
          </p>
        </Aside>
      </Section>

      <Section id="seven-letters" title="七个字母">
        <p>
          白键用字母表的前七个字母命名，从 A 到 G，G 之后又回到 A。不过音乐里习惯从 C
          数起，我们也这样：
          <strong>C D E F G A B</strong>，然后又是 C。
        </p>
        <p>只要记住两个地标，其余的都能推出来：</p>
        <ul>
          <li>
            <strong>C</strong>：紧挨在「两个一组」黑键左边的白键。
          </li>
          <li>
            <strong>F</strong>：紧挨在「三个一组」黑键左边的白键。
          </li>
        </ul>
        <p>
          从 C 往上按字母走：D 在两个黑键中间，E 在它们右边。从 F 往上：G 和 A 夹在三个黑键之间，B
          在它们右边。
        </p>
        <Plate caption="C 挨着两个一组的黑键，F 挨着三个一组的黑键，其余五个按顺序排下去。">
          <LetterKeys labels={{ c: 'C', f: 'F', all: '七个全显示' }} />
        </Plate>
        <Plate>
          <FindKeys range={THREE_OCTAVES} groupOf={isC} prompt="弹出这段键盘上所有的 C。" />
        </Plate>
        <Plate>
          <FindKeys range={THREE_OCTAVES} groupOf={isF} prompt="再弹出所有的 F。" />
        </Plate>
      </Section>

      <Section id="middle-c" title="中央 C 与八度">
        <p>
          从一个 C 到下一个 C 叫一个<strong>八度</strong>：连两头的 C 算在内是八个白键。不算上面那个
          C，连黑键一共十二个键，这就是那个不断重复的图案。名字也跟着图案重复，所以为了区分这些
          C，每个八度都有一个编号。
        </p>
        <p>
          离钢琴正中最近的那个 C 是 <strong>C4</strong>，叫作<strong>中央 C</strong>
          。从它往上直到下一个 B，都属于第 4 八度：D4、E4……一直到 B4。再往上的 C 开始第 5 八度，是
          C5。往下，中央 C 左边紧挨着的 B 是 B3。
        </p>
        <p>
          中央 C 就是你的大本营。面对它坐好，它正好是两只手的分界：右手通常从中央 C
          往上弹，左手在它下面。
        </p>
        <Plate
          wide
          caption="完整的 88 个键，每个 C 都标了名字。随便弹一个键，看看它叫什么，以及同一个字母在其他八度的位置。"
        >
          <NameAnyKey />
        </Plate>
        <Aside title="键盘比较小的话">
          <p>
            一台完整的钢琴从 A0 到 C8。很多电子键盘只有 61 键或 49 键，中央 C 仍然是
            C4，只是离左端更近。拿不准的话，弹一下你认为是中央 C 的键，在上面看看它的名字。
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="试一试：按名字找键">
        <p>
          现在把学到的连起来。每道题给出一个键的名字和八度。靠黑键的分组和八度去找，不要从头数。
        </p>
        <Plate>
          <KeyQuiz
            range={THREE_OCTAVES}
            items={[60, 62, 64, 67, 57, 53, 72, 71, 55, 65].map((key) => ({
              key,
              ask: `弹出 ${keyName(key)}`,
            }))}
            onComplete={complete}
          />
        </Plate>
        <p>
          这就是整个键盘：一个图案、七个字母，再加上八度的编号。下一课讲五线谱：写在五条线上的一个音符，怎样告诉你该弹哪个键。
        </p>
      </Section>
    </>
  );
}
