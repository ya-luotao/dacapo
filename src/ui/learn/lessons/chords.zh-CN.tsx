import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { cadenceSound, chordKeys, type Cadence } from '../harmony.ts';
import {
  Cadences,
  ChordBuilder,
  ChordQuiz,
  KeyChords,
  PreludeHarmony,
  Resolution,
  SymbolCard,
  type BuilderLabels,
  type ChordItem,
} from '../harmonyFigures.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const QUALITIES = {
  major: '大三和弦',
  minor: '小三和弦',
  diminished: '减三和弦',
  augmented: '增三和弦',
  dom7: '属七和弦',
  maj7: '大七和弦',
  min7: '小七和弦',
  hdim7: '半减七和弦',
};

const BUILDER: BuilderLabels = {
  root: '根音',
  qualities: QUALITIES,
  steps: {
    major: '下面大三度，上面小三度',
    minor: '下面小三度，上面大三度',
    diminished: '两个小三度',
    augmented: '两个大三度',
    dom7: '大三和弦加小七度',
    maj7: '大三和弦加大七度',
    min7: '小三和弦加小七度',
    hdim7: '减三和弦加小七度',
  },
  inversions: ['原位', '第一转位', '第二转位'],
  bass: '低音是 {note}',
};

const CADENCE_NAMES: Record<Cadence, string> = {
  authentic: '正格终止',
  plagal: '变格终止',
  half: '半终止',
  deceptive: '阻碍终止',
};

const TRIAD_ITEMS: readonly ChordItem[] = (
  [
    ['F 上的大三和弦', ['F4', 'A4', 'C5'], 'F A C'],
    ['D 上的小三和弦', ['D4', 'F4', 'A4'], 'D F A'],
    ['G 上的大三和弦', ['G4', 'B4', 'D5'], 'G B D'],
    ['E 上的小三和弦', ['E4', 'G4', 'B4'], 'E G B'],
    ['B 上的减三和弦', ['B3', 'D4', 'F4'], 'B D F'],
    ['C 上的增三和弦', ['C4', 'E4', 'G#4'], 'C E G♯'],
  ] as const
).map(([chord, notes, answer]) => {
  const keys = chordKeys(notes);
  return { ask: `弹出${chord}。`, keys, answer, given: keys[0] };
});

const SYMBOL_ITEMS: readonly ChordItem[] = (
  [
    ['Am', ['A3', 'C4', 'E4'], 'A C E'],
    ['G7', ['G3', 'B3', 'D4', 'F4'], 'G B D F'],
    ['F/A', ['A3', 'C4', 'F4'], 'F A C，A 在最低', true],
    ['B°', ['B3', 'D4', 'F4'], 'B D F'],
    ['Cmaj7', ['C4', 'E4', 'G4', 'B4'], 'C E G B'],
    ['E–', ['E4', 'G4', 'B4'], 'E G B'],
    ['Bø7', ['B3', 'D4', 'F4', 'A4'], 'B D F A'],
    ['Gsus4', ['G3', 'C4', 'D4'], 'G C D'],
  ] as const
).map(([symbol, notes, answer, bass]) => ({
  ask: '弹出这个和弦。',
  keys: chordKeys(notes),
  answer,
  bass: bass ?? false,
  figure: <SymbolCard symbol={symbol} />,
}));

const OPTIONS = ['正格终止：V → I', '变格终止：IV → I', '半终止：停在 V 上', '阻碍终止：V → vi'];
const ORDER: readonly Cadence[] = ['authentic', 'plagal', 'half', 'deceptive'];
const HEARD: readonly ChoiceQuestion[] = (
  [
    ['authentic', 0],
    ['half', 5],
    ['deceptive', 0],
    ['plagal', -3],
    ['half', -2],
    ['authentic', -5],
    ['plagal', 2],
    ['deceptive', -4],
  ] as const
).map(([cadence, shift], i) => ({
  id: `${cadence}-${i}`,
  question: '听一听：这个乐句是怎么结束的？',
  figure: null,
  options: OPTIONS,
  answer: ORDER.indexOf(cadence),
  sound: cadenceSound(cadence, shift),
  gap: 850,
}));

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        三个音一起弹，就是一个<strong>和弦</strong>
        。大多数音乐都是一条旋律加上下面的和弦：和弦给音乐上色，也让人感到它在往哪里走、什么时候到了家。这一课来搭和弦、给和弦起名字，再到曲子里去找和弦。
      </p>

      <Section id="triads" title="三和弦：按三度叠起来">
        <p>
          随便选一个音，往上加一个三度，再往上加一个三度：C、E、G。三个音按三度叠在一起，就是
          <strong>三和弦</strong>
          ，最常见的和弦。在谱上很好认：三个音都在线上、一条挨一条，或者都在间里。
        </p>
        <p>
          最下面的音叫<strong>根音</strong>，和弦就用它来命名。另外两个音从根音往上数，叫
          <strong>三音</strong>和<strong>五音</strong>。叠的是哪两种三度，决定了三和弦的性质：
        </p>
        <ul>
          <li>
            <strong>大三和弦</strong>：下面大三度（四个半音），上面小三度（三个半音）。明亮、稳定。C
            E G。
          </li>
          <li>
            <strong>小三和弦</strong>：下面小三度，上面大三度。暗一些。C E♭ G。
          </li>
          <li>
            <strong>减三和弦</strong>：两个小三度。紧张，站不稳。C E♭ G♭。
          </li>
          <li>
            <strong>增三和弦</strong>：两个大三度。古怪，悬而未决。C E G♯。
          </li>
        </ul>
        <Plate
          wide
          caption="选一个根音和一种和弦。谱上先把三个音依次写出来，再叠在一起；听一听，先分解，再柱式。"
        >
          <ChordBuilder
            qualities={['major', 'minor', 'diminished', 'augmented']}
            labels={BUILDER}
            staffLabel="高音谱表上的一个三和弦"
          />
        </Plate>
        <p>
          大三和弦和小三和弦到处都是，减三和弦偶尔出现，增三和弦很少见。「大」「小」「增」「减」说的不是和弦有多宽：四种和弦都差不多跨一个五度。
        </p>
      </Section>

      <Section id="inversions" title="转位与低音">
        <p>
          和弦的几个音可以换顺序。根音在最下面，叫<strong>原位</strong>
          。把根音移高一个八度，三音就到了最下面，这是<strong>第一转位</strong>：E G
          C。再把三音也移上去，五音在最下面，这是<strong>第二转位</strong>：G C E。
        </p>
        <p>
          它还是 C 大三和弦，听起来却不完全一样。最下面的音叫<strong>低音</strong>
          ，它给整个和弦定下色彩。原位听起来最稳；第一转位轻一些，像是正在往别处走；第二转位不太稳，通常一带而过。
        </p>
        <Plate wide caption="选一种排列，注意听低音：还是这三个音，最下面换了一个。">
          <ChordBuilder
            qualities={['major', 'minor']}
            inversions
            labels={BUILDER}
            staffLabel="高音谱表上的一个三和弦"
          />
        </Plate>
        <Aside title="用耳朵听">
          <p>
            <Link href="/ear">「练耳」</Link>
            会弹出三和弦，让你说出名称或者在琴上弹出来：先是大三和弦和小三和弦，然后加上减三和弦和增三和弦，再到转位，那时低音也要对。
          </p>
        </Aside>
      </Section>

      <Section id="key" title="一个调里的和弦">
        <p>
          在 C
          大调音阶的每个音上都搭一个三和弦，只用音阶里的音，就得到七个和弦。它们是这个调的和弦，C
          大调的音乐大多是用它们写成的。
        </p>
        <p>
          每个和弦用一个<strong>罗马数字</strong>
          来表示它建在音阶的第几级上，所以这套名字在哪个调里都通用。大写表示大三和弦，小写表示小三和弦，右上角加一个小圆圈表示减三和弦：I
          ii iii IV V vi vii°。换一个调，音会变，这个规律永远不变。
        </p>
        <Plate
          wide
          caption="一个大调的七个三和弦，上面是和弦记号，下面是级数。点一个听一听，或者点「听一听」依次听全部。"
        >
          <KeyChords
            labels={{
              key: '调',
              qualities: { major: '大三和弦', minor: '小三和弦', diminished: '减三和弦' },
            }}
            staffLabel="高音谱表上这个调的七个三和弦"
          />
        </Plate>
        <p>
          其中三个和弦担起了大部分工作：I、IV、V，叫<strong>正三和弦</strong>。I 级是
          <strong>主和弦</strong>，是家。V 级是<strong>属和弦</strong>，最有力地把音乐引回家。IV
          级是<strong>下属和弦</strong>
          ，离家一步。三个和弦加起来包含了音阶里的每一个音，所以很多简单的曲子，只用这三个和弦就能伴奏。
        </p>
        <p>
          小调也有自己的和弦。它的主和弦和下属和弦是小三和弦，写成 i 和 iv；V
          级却是大三和弦，因为和声小调升高了第 7 音，也就是「小调音阶与小调」一课里讲过的导音。
        </p>
      </Section>

      <Section id="sevenths" title="七和弦">
        <p>
          在三和弦上再叠一个三度，就有了四个音：<strong>七和弦</strong>
          ，名字来自根音到最上面那个音的距离。最常遇到的是建在 V 级上的<strong>属七和弦</strong>：C
          大调里是 G B D F，记作 G7。它是一个大三和弦，上面加一个小七度。
        </p>
        <Plate wide caption="最常见的四种七和弦，可以建在任何一个根音上。">
          <ChordBuilder
            qualities={['dom7', 'maj7', 'min7', 'hdim7']}
            initialRoot="G"
            labels={BUILDER}
            staffLabel="高音谱表上的一个七和弦"
          />
        </Plate>
        <p>
          V7 为什么这么想回到 I？看它的两个音。B 是导音，比 C 低半音，想往上走到 C。F
          是七音，想往下走半音到 E。B 和 F 相距三个全音，叫<strong>三全音</strong>
          ，是调里最不安定的音程。等它们走到 C 和 E，紧张一下子消失，音乐就到家了。
        </p>
        <Plate caption="先听 V 到 I，再听 V7 到 I：多出来的 F 落到 E，同时 B 升到 C。">
          <Resolution
            labels={{ triad: 'V → I', seventh: 'V7 → I' }}
            readouts={{
              triad: 'G B D 到 C E G：B 升到 C。',
              seventh: 'G B D F 到 C E C：B 升到 C，F 落到 E。',
            }}
            staffLabel="大谱表上的两个和弦：G7 或 G，然后是 C"
          />
        </Plate>
      </Section>

      <Section id="cadences" title="终止式">
        <p>
          乐句结尾收住它的那几个和弦，叫<strong>终止式</strong>
          。终止式就像音乐里的标点符号，有四种你会一再听到：
        </p>
        <ul>
          <li>
            <strong>正格终止</strong>，V（或 V7）到 I：句号。大多数曲子都这样结束。
          </li>
          <li>
            <strong>变格终止</strong>，IV 到 I：更柔和，就是赞美诗末尾那一声「阿门」。
          </li>
          <li>
            <strong>半终止</strong>，停在 V 上：逗号，或者一个等着回答的问题。
          </li>
          <li>
            <strong>阻碍终止</strong>（也叫伪终止），V 到 vi：耳朵等着
            I，来的却是一个小三和弦。出乎意料，音乐只好继续往下走。
          </li>
        </ul>
        <Plate caption="C 大调的一个短乐句，用四种方式结束。最后两个和弦就是终止式。">
          <Cadences
            labels={CADENCE_NAMES}
            readouts={{
              authentic: '句号：到家了。',
              plagal: '阿门：轻轻地到家。',
              half: '逗号：停在 V 上，等着。',
              deceptive: '以为到家，来的是 A 小三和弦：低音上行一步，双手和 I 一样。',
            }}
            staffLabel="大谱表上的四个和弦"
          />
        </Plate>
        <Aside title="一问一答">
          <p>
            很多旋律的乐句是成对的：第一句以半终止结束，像一个问题；第二句以正格终止结束，是回答。在《欢乐颂》里听一听。
          </p>
        </Aside>
      </Section>

      <Section id="symbols" title="和弦记号">
        <p>
          歌本、赞美诗集，还有爵士和流行音乐，常常只印旋律，在和弦变换的地方标一个
          <strong>和弦记号</strong>
          。这种谱子英文叫 lead
          sheet，钢琴伴奏要看着和弦记号自己编。和弦记号就是一个根音加几个字母：
        </p>
        <ul>
          <li>
            <strong>C</strong>：只有字母，是大三和弦，C E G。
          </li>
          <li>
            <strong>Am</strong>：m 是小三和弦，A C E。
          </li>
          <li>
            <strong>G7</strong>：只写 7，是属七和弦，G B D F。
          </li>
          <li>
            <strong>Cmaj7</strong>：大七和弦，C E G B。
          </li>
          <li>
            <strong>Dm7</strong>：小七和弦，D F A C。
          </li>
          <li>
            <strong>B°</strong>：减三和弦，B D F；<strong>C+</strong>：增三和弦，C E G♯。
          </li>
          <li>
            <strong>Bm7♭5</strong>：半减七和弦，B D F A。
          </li>
          <li>
            <strong>Csus4</strong>：挂留和弦，三音换成四音，C F G；Csus2 换成二音，C D G。
          </li>
          <li>
            <strong>F/A</strong>：斜线后面写的是低音，这里是 F 大三和弦、A
            在最下面，也就是它的第一转位。
          </li>
        </ul>
        <p>
          同一个和弦记号有好几种写法，这些也要认得：maj7 也写成 Δ 或 M7（CΔ7），m 也写成 – 或
          min（C–），m7♭5 写成 ø（Bø7），° 写成 dim，+ 写成 aug。
        </p>
      </Section>

      <Section id="in-a-piece" title="在曲子里找和弦">
        <p>
          普通的乐谱很少标出和弦，但和弦就在里面。要找出来，先看<strong>低音</strong>
          ，也就是最低的音，它常常就是根音。再把强拍上的音收集起来，按三度叠一叠。放不进去的音，夹在两个和弦音之间，是经过音。
        </p>
        <p>
          巴赫的《C
          大调前奏曲》是最清楚的例子：每一小节就是一个和弦，用同一个音型分解开。把一小节折起来，就能当作一个和弦来弹。
        </p>
        <Plate caption="《C 大调前奏曲》的前四小节，每小节折成一个和弦：C，低音是 C 的 D 小七和弦，低音是 B 的 G7，再回到 C。先听巴赫写的样子，再听和弦。">
          <PreludeHarmony
            labels={{ written: '原谱', chords: '和弦' }}
            staffLabel="大谱表上的四个和弦：巴赫《C 大调前奏曲》的前几小节"
          />
        </Plate>
        <p>
          这四小节是
          I、ii7、V7、I：从家出发，又回到家，低音几乎不动。知道了和弦，曲子学起来、记起来都更容易。在
          <Link href="/pieces/bach-prelude-in-c">「曲目」</Link>
          里弹这首前奏曲时，试着每弹一小节之前先说出它的和弦。
        </p>
      </Section>

      <Section id="try-it" title="试一试">
        <p>
          先按根音弹出三和弦，再照和弦记号弹出和弦，哪个八度都行，几个音一起弹或一个一个弹都可以。最后用耳朵认几个终止式。
        </p>
        <Plate>
          <ChordQuiz items={TRIAD_ITEMS} />
        </Plate>
        <Plate>
          <ChordQuiz items={SYMBOL_ITEMS} />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="终止式。" questions={HEARD} onComplete={complete} />
        </Plate>
        <p>
          想多练终止式，可以在
          <Link href="/ear">「练耳」</Link>
          里选「终止式」：每个调都有，也有小调；听四个和弦，说出最后两个和弦构成的终止式。
        </p>
        <p>
          <Link href="/ear">「练耳」</Link>
          会弹出和弦让你说出名称或弹出来，从大三和弦、小三和弦，一直到转位和这一课的四种七和弦。
        </p>
        <p>
          <Link href="/harmony">「和声」</Link>
          会一个接一个地出和弦记号让你弹，从 C、G、F
          大调的三和弦，到七和弦、斜线和弦和这一课列出的其他和弦，每个调都有。
        </p>
      </Section>
    </>
  );
}
