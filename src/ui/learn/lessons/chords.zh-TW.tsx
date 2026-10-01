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
  diminished: '減三和弦',
  augmented: '增三和弦',
  dom7: '屬七和弦',
  maj7: '大七和弦',
  min7: '小七和弦',
  hdim7: '半減七和弦',
};

const BUILDER: BuilderLabels = {
  root: '根音',
  qualities: QUALITIES,
  steps: {
    major: '下面大三度，上面小三度',
    minor: '下面小三度，上面大三度',
    diminished: '兩個小三度',
    augmented: '兩個大三度',
    dom7: '大三和弦加小七度',
    maj7: '大三和弦加大七度',
    min7: '小三和弦加小七度',
    hdim7: '減三和弦加小七度',
  },
  inversions: ['原位', '第一轉位', '第二轉位'],
  bass: '低音是 {note}',
};

const CADENCE_NAMES: Record<Cadence, string> = {
  authentic: '正格終止',
  plagal: '變格終止',
  half: '半終止',
  deceptive: '阻礙終止',
};

const TRIAD_ITEMS: readonly ChordItem[] = (
  [
    ['F 上的大三和弦', ['F4', 'A4', 'C5'], 'F A C'],
    ['D 上的小三和弦', ['D4', 'F4', 'A4'], 'D F A'],
    ['G 上的大三和弦', ['G4', 'B4', 'D5'], 'G B D'],
    ['E 上的小三和弦', ['E4', 'G4', 'B4'], 'E G B'],
    ['B 上的減三和弦', ['B3', 'D4', 'F4'], 'B D F'],
    ['C 上的增三和弦', ['C4', 'E4', 'G#4'], 'C E G♯'],
  ] as const
).map(([chord, notes, answer]) => {
  const keys = chordKeys(notes);
  return { ask: `彈出${chord}。`, keys, answer, given: keys[0] };
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
  ask: '彈出這個和弦。',
  keys: chordKeys(notes),
  answer,
  bass: bass ?? false,
  figure: <SymbolCard symbol={symbol} />,
}));

const OPTIONS = ['正格終止：V → I', '變格終止：IV → I', '半終止：停在 V 上', '阻礙終止：V → vi'];
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
  question: '聽聽看：這個樂句是怎麼結束的？',
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
        三個音一起彈，就是一個<strong>和弦</strong>
        。大多數音樂都是一條旋律加上下面的和弦：和弦替音樂上色，也讓人感覺到它正往哪裡走、什麼時候到了家。這一課來搭和弦、替和弦取名字，再到曲子裡去找和弦。
      </p>

      <Section id="triads" title="三和弦：照三度疊起來">
        <p>
          隨便選一個音，往上加一個三度，再往上加一個三度：C、E、G。三個音照三度疊在一起，就是
          <strong>三和弦</strong>
          ，最常見的和弦。在譜上很好認：三個音都在線上、一條接一條，或者都在間裡。
        </p>
        <p>
          最下面的音叫<strong>根音</strong>，和弦就用它來命名。另外兩個音從根音往上數，叫
          <strong>三音</strong>和<strong>五音</strong>。疊的是哪兩種三度，決定了三和弦的性質：
        </p>
        <ul>
          <li>
            <strong>大三和弦</strong>：下面大三度（四個半音），上面小三度（三個半音）。明亮、穩定。C
            E G。
          </li>
          <li>
            <strong>小三和弦</strong>：下面小三度，上面大三度。暗一些。C E♭ G。
          </li>
          <li>
            <strong>減三和弦</strong>：兩個小三度。緊張，站不穩。C E♭ G♭。
          </li>
          <li>
            <strong>增三和弦</strong>：兩個大三度。古怪，懸而未決。C E G♯。
          </li>
        </ul>
        <Plate
          wide
          caption="選一個根音和一種和弦。譜上先把三個音依序寫出來，再疊在一起；聽聽看，先分解，再柱式。"
        >
          <ChordBuilder
            qualities={['major', 'minor', 'diminished', 'augmented']}
            labels={BUILDER}
            staffLabel="高音譜表上的一個三和弦"
          />
        </Plate>
        <p>
          大三和弦和小三和弦到處都是，減三和弦偶爾出現，增三和弦很少見。「大」「小」「增」「減」說的不是和弦有多寬：四種和弦都差不多跨一個五度。
        </p>
      </Section>

      <Section id="inversions" title="轉位與低音">
        <p>
          和弦的幾個音可以換順序。根音在最下面，叫<strong>原位</strong>
          。把根音移高一個八度，三音就到了最下面，這是<strong>第一轉位</strong>：E G
          C。再把三音也移上去，五音在最下面，這是<strong>第二轉位</strong>：G C E。
        </p>
        <p>
          它還是 C 大三和弦，聽起來卻不完全一樣。最下面的音叫<strong>低音</strong>
          ，它替整個和弦定下色彩。原位聽起來最穩；第一轉位輕一些，像是正要往別處走；第二轉位不太穩，通常一帶而過。
        </p>
        <Plate wide caption="選一種排列，注意聽低音：還是這三個音，最下面換了一個。">
          <ChordBuilder
            qualities={['major', 'minor']}
            inversions
            labels={BUILDER}
            staffLabel="高音譜表上的一個三和弦"
          />
        </Plate>
        <Aside title="用耳朵聽">
          <p>
            <Link href="/ear">「練耳」</Link>
            會彈出三和弦，讓你說出名稱或者在琴上彈出來：先是大三和弦和小三和弦，然後加上減三和弦和增三和弦，再到轉位，那時低音也要對。
          </p>
        </Aside>
      </Section>

      <Section id="key" title="一個調裡的和弦">
        <p>
          在 C
          大調音階的每個音上都搭一個三和弦，只用音階裡的音，就得到七個和弦。它們是這個調的和弦，C
          大調的音樂大多是用它們寫成的。
        </p>
        <p>
          每個和弦用一個<strong>羅馬數字</strong>
          來表示它建立在音階的第幾級上，所以這套名字在哪個調裡都通用。大寫表示大三和弦，小寫表示小三和弦，右上角加一個小圓圈表示減三和弦：I
          ii iii IV V vi vii°。換一個調，音會變，這個規律永遠不變。
        </p>
        <Plate
          wide
          caption="一個大調的七個三和弦，上面是和弦記號，下面是級數。點一個聽聽看，或者點「聽聽看」依序聽全部。"
        >
          <KeyChords
            labels={{
              key: '調',
              qualities: { major: '大三和弦', minor: '小三和弦', diminished: '減三和弦' },
            }}
            staffLabel="高音譜表上這個調的七個三和弦"
          />
        </Plate>
        <p>
          其中三個和弦擔起了大部分的工作：I、IV、V，叫<strong>正三和弦</strong>。I 級是
          <strong>主和弦</strong>，是家。V 級是<strong>屬和弦</strong>，最有力地把音樂引回家。IV
          級是<strong>下屬和弦</strong>
          ，離家一步。三個和弦加起來包含了音階裡的每一個音，所以很多簡單的曲子，只用這三個和弦就能伴奏。
        </p>
        <p>
          小調也有自己的和弦。它的主和弦和下屬和弦是小三和弦，寫成 i 和 iv；V
          級卻是大三和弦，因為和聲小調升高了第 7 音，也就是「小調音階與小調」一課裡講過的導音。
        </p>
      </Section>

      <Section id="sevenths" title="七和弦">
        <p>
          在三和弦上再疊一個三度，就有了四個音：<strong>七和弦</strong>
          ，名字來自根音到最上面那個音的距離。最常遇到的是建立在 V 級上的<strong>屬七和弦</strong>
          ：C 大調裡是 G B D F，記作 G7。它是一個大三和弦，上面加一個小七度。
        </p>
        <Plate wide caption="最常見的四種七和弦，可以建立在任何一個根音上。">
          <ChordBuilder
            qualities={['dom7', 'maj7', 'min7', 'hdim7']}
            initialRoot="G"
            labels={BUILDER}
            staffLabel="高音譜表上的一個七和弦"
          />
        </Plate>
        <p>
          V7 為什麼這麼想回到 I？看它的兩個音。B 是導音，比 C 低半音，想往上走到 C。F
          是七音，想往下走半音到 E。B 和 F 相距三個全音，叫<strong>三全音</strong>
          ，是調裡最不安定的音程。等它們走到 C 和 E，緊張一下子消失，音樂就到家了。
        </p>
        <Plate caption="先聽 V 到 I，再聽 V7 到 I：多出來的 F 落到 E，同時 B 升到 C。">
          <Resolution
            labels={{ triad: 'V → I', seventh: 'V7 → I' }}
            readouts={{
              triad: 'G B D 到 C E G：B 升到 C。',
              seventh: 'G B D F 到 C E C：B 升到 C，F 落到 E。',
            }}
            staffLabel="大譜表上的兩個和弦：G7 或 G，然後是 C"
          />
        </Plate>
      </Section>

      <Section id="cadences" title="終止式">
        <p>
          樂句結尾把它收住的那幾個和弦，叫<strong>終止式</strong>
          。終止式就像音樂裡的標點符號，有四種你會一再聽到：
        </p>
        <ul>
          <li>
            <strong>正格終止</strong>，V（或 V7）到 I：句號。大多數曲子都這樣結束。
          </li>
          <li>
            <strong>變格終止</strong>，IV 到 I：比較柔和，就是聖詩末尾那一聲「阿們」。
          </li>
          <li>
            <strong>半終止</strong>，停在 V 上：逗號，或者一個等著回答的問題。
          </li>
          <li>
            <strong>阻礙終止</strong>（也叫假終止），V 到 vi：耳朵等著
            I，來的卻是一個小三和弦。出乎意料，音樂只好繼續往下走。
          </li>
        </ul>
        <Plate caption="C 大調的一個短樂句，用四種方式結束。最後兩個和弦就是終止式。">
          <Cadences
            labels={CADENCE_NAMES}
            readouts={{
              authentic: '句號：到家了。',
              plagal: '阿們：輕輕地到家。',
              half: '逗號：停在 V 上，等著。',
              deceptive: '以為到家了，來的卻是 A 小三和弦：低音上行一步，雙手和 I 一樣。',
            }}
            staffLabel="大譜表上的四個和弦"
          />
        </Plate>
        <Aside title="一問一答">
          <p>
            很多旋律的樂句是成對的：第一句以半終止結束，像一個問題；第二句以正格終止結束，是回答。在〈快樂頌〉裡聽聽看。
          </p>
        </Aside>
      </Section>

      <Section id="symbols" title="和弦記號">
        <p>
          歌本、聖詩集，還有爵士和流行音樂，常常只印旋律，在和弦變換的地方標一個
          <strong>和弦記號</strong>
          。這種譜子叫旋律譜（英文是 lead
          sheet），鋼琴伴奏要看著和弦記號自己編。和弦記號就是一個根音加幾個字母：
        </p>
        <ul>
          <li>
            <strong>C</strong>：只有字母，是大三和弦，C E G。
          </li>
          <li>
            <strong>Am</strong>：m 是小三和弦，A C E。
          </li>
          <li>
            <strong>G7</strong>：只寫 7，是屬七和弦，G B D F。
          </li>
          <li>
            <strong>Cmaj7</strong>：大七和弦，C E G B。
          </li>
          <li>
            <strong>Dm7</strong>：小七和弦，D F A C。
          </li>
          <li>
            <strong>B°</strong>：減三和弦，B D F；<strong>C+</strong>：增三和弦，C E G♯。
          </li>
          <li>
            <strong>Bm7♭5</strong>：半減七和弦，B D F A。
          </li>
          <li>
            <strong>Csus4</strong>：掛留和弦，三音換成四音，C F G；Csus2 換成二音，C D G。
          </li>
          <li>
            <strong>F/A</strong>：斜線後面寫的是低音，這裡是 F 大三和弦、A
            在最下面，也就是它的第一轉位。
          </li>
        </ul>
        <p>
          同一個和弦記號有好幾種寫法，這些也要認得：maj7 也寫成 Δ 或 M7（CΔ7），m 也寫成 – 或
          min（C–），m7♭5 寫成 ø（Bø7），° 寫成 dim，+ 寫成 aug。
        </p>
      </Section>

      <Section id="in-a-piece" title="在曲子裡找和弦">
        <p>
          一般的樂譜很少標出和弦，但和弦就在裡面。要找出來，先看<strong>低音</strong>
          ，也就是最低的音，它常常就是根音。再把強拍上的音收集起來，照三度疊疊看。放不進去的音，夾在兩個和弦音之間，是經過音。
        </p>
        <p>
          巴哈的〈C
          大調前奏曲〉是最清楚的例子：每一小節就是一個和弦，用同一個音型分解開來。把一小節摺起來，就能當作一個和弦來彈。
        </p>
        <Plate caption="〈C 大調前奏曲〉的前四小節，每小節摺成一個和弦：C，低音是 C 的 D 小七和弦，低音是 B 的 G7，再回到 C。先聽巴哈寫的樣子，再聽和弦。">
          <PreludeHarmony
            labels={{ written: '原譜', chords: '和弦' }}
            staffLabel="大譜表上的四個和弦：巴哈〈C 大調前奏曲〉的前幾小節"
          />
        </Plate>
        <p>
          這四小節是
          I、ii7、V7、I：從家出發，又回到家，低音幾乎不動。知道了和弦，曲子學起來、記起來都更容易。在
          <Link href="/pieces/bach-prelude-in-c">「樂曲」</Link>
          裡彈這首前奏曲時，試著在每彈一小節之前先說出它的和弦。
        </p>
      </Section>

      <Section id="try-it" title="試一試">
        <p>
          先照根音彈出三和弦，再照和弦記號彈出和弦，哪個八度都可以，幾個音可以一起彈，也可以一個一個彈。最後用耳朵認幾個終止式。
        </p>
        <Plate>
          <ChordQuiz items={TRIAD_ITEMS} />
        </Plate>
        <Plate>
          <ChordQuiz items={SYMBOL_ITEMS} />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="終止式。" questions={HEARD} onComplete={complete} />
        </Plate>
        <p>
          想多練終止式，可以在
          <Link href="/ear">「練耳」</Link>
          裡選「終止式」：每個調都有，也有小調；聽四個和弦，說出最後兩個和弦構成的終止式。
        </p>
        <p>
          <Link href="/ear">「練耳」</Link>
          會彈出和弦讓你說出名稱或彈出來，從大三和弦、小三和弦，一直到轉位和這一課的四種七和弦。
        </p>
        <p>
          <Link href="/harmony">「和聲」</Link>
          會一個接一個地出和弦記號讓你彈，從 C、G、F
          大調的三和弦，到七和弦、斜線和弦和這一課列出的其他和弦，每個調都有。
        </p>
      </Section>
    </>
  );
}
