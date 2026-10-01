import { ChoiceQuiz, KeyQuiz, SequenceExercise, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { phraseIn, scaleKeys, scaleUp } from '../notes.ts';
import {
  LeadingNote,
  MajorAndMinor,
  MinorScaleBuilder,
  MinorScaleCard,
  RelativeMinor,
  SignatureCard,
  SnippetCard,
  TellTheKey,
  ThirdAndChord,
  type MinorKind,
} from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 83]; // C3–B5
const A_HARMONIC = scaleKeys('harmonicMinor', 'A');

const BUILDER = {
  tonic: '調',
  natural: '自然小調',
  harmonic: '和聲小調',
  melodic: '旋律小調',
  accidentals: '寫升降記號',
  signature: '用調號',
  steps: '音階的每一步',
  up: '上行的每一步',
  down: '下行的每一步',
  whole: '全',
  half: '半',
  augmented: '增二',
};

// 一個大調的調號，和它的關係小調的主音。
const RELATIVES: readonly [string, number][] = [
  ['G', 64], // E
  ['F', 62], // D
  ['D', 59], // B
  ['C', 69], // A
  ['Bb', 67], // G
  ['A', 66], // F♯
  ['Eb', 60], // C
];

const KINDS = ['自然小調', '和聲小調', '旋律小調'];
const KIND_INDEX: Record<MinorKind, number> = {
  naturalMinor: 0,
  harmonicMinor: 1,
  melodicMinor: 2,
};
const SEEN = '譜上寫的是哪一種小調音階？';
const HEARD = '聽聽看：這是哪一種小調音階？';
const WHICH_MINOR: readonly ChoiceQuestion[] = (
  [
    ['harmonicMinor', 'A', true],
    ['naturalMinor', 'E', true],
    ['melodicMinor', 'D', true],
    ['harmonicMinor', 'C', false],
    ['melodicMinor', 'A', false],
    ['naturalMinor', 'G', false],
  ] as const
).map(([kind, tonic, seen]) => ({
  id: `${kind}-${tonic}`,
  question: seen ? SEEN : HEARD,
  figure: seen ? <MinorScaleCard kind={kind} tonic={tonic} label="一條小調音階" /> : null,
  options: KINDS,
  answer: KIND_INDEX[kind],
  sound: scaleUp(kind, tonic),
}));

const WHICH_KEY: readonly ChoiceQuestion[] = (
  [
    ['A', 'minor', ['C 大調', 'A 小調']],
    ['G', 'major', ['G 大調', 'E 小調']],
    ['D', 'minor', ['F 大調', 'D 小調']],
    ['D', 'major', ['D 大調', 'B 小調']],
    ['G', 'minor', ['降 B 大調', 'G 小調']],
    ['F', 'major', ['F 大調', 'D 小調']],
  ] as const
).map(([tonic, mode, options]) => ({
  id: `${tonic}-${mode}`,
  figure: <SnippetCard snippetKey={{ tonic, mode }} label="大譜表上的一個樂句" />,
  sound: phraseIn({ tonic, mode }).sound,
  options,
  answer: mode === 'major' ? 0 : 1,
}));

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        到目前為止，你彈的音階都是大調。和它成對的是小調，聲音比較暗、比較憂傷，你以後彈的曲子裡有不少是小調。每個小調都和一個大調用同樣的音，卻有自己的「家」；小調音階還有三種形式。
      </p>

      <Section id="sound" title="小調的聲音">
        <p>
          把一首熟悉的曲子彈兩遍，一遍大調，一遍小調。〈兩隻老虎〉在 C 大調裡是 C D E C。換到 C
          小調，只有一個音變了：音階的第三個音 E 降低半音，成了
          E♭。就這一個鍵，明亮的曲子一下子暗了下來。
        </p>
        <Plate caption="先用 C 大調聽一遍，再切換到 C 小調聽一遍。只有 E 變了。">
          <MajorAndMinor
            staffLabel="高音譜表上的〈兩隻老虎〉"
            labels={{ major: 'C 大調', minor: 'C 小調' }}
          />
        </Plate>
        <Aside title="馬勒也這麼做過">
          <p>
            馬勒《第一號交響曲》的第三樂章，把這首曲子（在德國叫〈馬丁兄弟〉）改成小調、放慢，成了一首送葬進行曲。
          </p>
        </Aside>
        <p>
          你聽到的，是<strong>主音</strong>（音階的第一個音）到第三個音的距離。大調裡是四個半音，叫
          <strong>大三度</strong>；小調裡是三個半音，叫<strong>小三度</strong>
          。把主音、三音和五音疊在一起就是一個和弦，它是大是小也是這個原因：C E G
          是大三和弦，聽起來明亮；C E♭ G 是小三和弦，聽起來憂傷。
        </p>
        <Plate caption="在大調和小調之間切換，聽聽三度，再聽聽和弦。">
          <ThirdAndChord
            staffLabel="高音譜表上的一個三度和一個和弦"
            labels={{
              major: '大調',
              minor: '小調',
              third: '三度',
              chord: '和弦',
              readout: {
                major: { name: 'C → E', label: '四個半音：大三度' },
                minor: { name: 'C → E♭', label: '三個半音：小三度' },
              },
            }}
          />
        </Plate>
      </Section>

      <Section id="relative" title="關係小調">
        <p>
          再彈一遍白鍵，不過這次從 A 彈到 A：A B C D E F G A。用的還是 C
          大調那七個音，聽起來卻是小調，因為現在家在 A。這就是 A 小調，C 大調的
          <strong>關係小調</strong>。
        </p>
        <p>
          每個大調都有一個關係小調。它從大調音階的第 6
          個音開始；也可以從大調的主音往下數一個小三度：C、B、A。兩個調的音完全一樣，所以調號也一樣。
        </p>
        <Plate
          wide
          caption="選一個大調，聽它的音階；再切換到它的關係小調。音和調號都不變，變的只是從哪個音開始。"
        >
          <RelativeMinor
            staffLabel="帶調號的大調音階或它的關係小調"
            labels={{
              key: '大調',
              majorName: '{tonic} 大調',
              minorName: '{tonic} 小調',
              readout: {
                major: '{minor} 小調從 {major} 大調的第 6 個音開始。',
                minor: '和 {major} 大調同樣的音、同樣的調號，從 {minor} 到 {minor}。',
              },
            }}
          />
        </Plate>
        <Aside title="往下三個半音">
          <p>
            找一個大調的關係小調：從主音往下數三個半音，字母往下數兩個。G 大調對應 E 小調，F
            大調對應 D 小調。反過來，從小調的主音往上三個半音，就是它的關係大調。
          </p>
        </Aside>
      </Section>

      <Section id="natural" title="自然小調">
        <p>
          從 A 到 A、一個音都不改，就是<strong>自然小調</strong>
          音階。像量大調音階那樣量一量每一步：全、半、全、全、半、全、全。半音落在別的位置：第 2、3
          個音之間，第 5、6 個音之間。正是這一點讓它聽起來是小調。
        </p>
        <p>
          從任何一個鍵開始，照這個規律走，就得到那個調的自然小調。從 E 開始要用 F♯，從 D 開始要用
          B♭：和它們的關係大調 G 大調、F 大調一樣。
        </p>
        <Plate
          wide
          caption="選一個調和一種小調：上面一排顯示每一步，鍵盤標出音階。比自然小調升高的音標了顏色。切換到「用調號」，就只寫調號沒有涵蓋的升降記號。"
        >
          <MinorScaleBuilder staffLabel="高音譜表上的小調音階" labels={BUILDER} />
        </Plate>
      </Section>

      <Section id="harmonic" title="和聲小調">
        <p>
          把 A 自然小調彈到頂，注意聽最後一步，G 到
          A。這是一個全音，音階像是慢慢晃回家，而不是一步到家。把第 7 個音升高半音，變成
          G♯，最後一步就成了半音：G♯ 緊貼著 A，就像 C 大調裡 B 緊貼著 C。比主音低半音的第 7 音叫
          <strong>導音</strong>，因為它把耳朵引向主音。
        </p>
        <p>
          第 7 音升高的自然小調，就是<strong>和聲小調</strong>。它的名字來自和聲：A
          小調的曲子結尾，最後一個和弦之前那個建立在 E 上的和弦，要有 G♯
          才有結束感。大多數小調曲子都會這樣升高第 7 音，所以譜上會常常看到它。
        </p>
        <Plate caption="在 G 和 G♯ 之間切換，聽聽音階最後幾個音，再聽聽 A 小調樂曲結尾的兩個和弦。">
          <LeadingNote
            staffLabel="A 小調音階的最後幾個音和兩個和弦"
            labels={{
              natural: 'G：自然小調',
              raised: 'G♯：和聲小調',
              scale: '音階最後幾個音',
              chords: '兩個和弦',
              readout: {
                natural: { name: 'G → A', label: '全音：慢慢晃回家。' },
                raised: { name: 'G♯ → A', label: '半音：這就是導音。F → G♯ 是增二度。' },
              },
            }}
          />
        </Plate>
        <p>
          升高第 7 音之後，它下面留出一個大空隙：F 到 G♯ 有三個半音，比全音還多一個半音，叫
          <strong>增二度</strong>
          。彈音階時這裡聽起來像一個小小的跳躍。在上面的音階圖裡選「和聲小調」，就能看到整個規律：全、半、全、全、半、增二、半。
        </p>
      </Section>

      <Section id="melodic" title="旋律小調">
        <p>
          增二度唱起來不順，所以往上走到主音的旋律，常常把第 6 音也升高：A 小調裡就是 F♯ 和 G♯。
          <strong>旋律小調</strong>上行是：全、半、全、全、全、全、半，和 A 大調只差第三個音。
        </p>
        <p>
          下行時用不到導音，兩個音都還原：先 G，再 F。旋律小調下行就是自然小調，dacapo
          的「音階」練習也是這樣彈的。
        </p>
        <Plate
          wide
          caption="旋律小調上行升高第 6、第 7 音，下行還原。換個調試試看：D 小調上行時，B♭ 變成 B，C 變成 C♯。"
        >
          <MinorScaleBuilder
            initial="melodicMinor"
            staffLabel="高音譜表上的旋律小調，上行再下行"
            labels={BUILDER}
          />
        </Plate>
        <Aside title="三種小調，一個調">
          <p>
            一首曲子用的是哪一種小調？三種都用：它們是同一個調，比如 A 小調，調號也相同。第 6、第 7
            音隨旋律的需要升高或還原，升高的音總是用臨時記號寫出來。
          </p>
        </Aside>
      </Section>

      <Section id="signatures" title="小調的調號">
        <p>
          小調用它關係大調的調號。A 小調沒有升降記號，和 C 大調一樣；E 小調一個升記號，和 G
          大調一樣；D 小調一個降記號，和 F 大調一樣。升高的第 6、第 7
          音從來不寫進調號，出現在哪裡，就在哪裡寫臨時記號。
        </p>
        <p>
          所以同一個調號對應兩個調。要分辨一首曲子是哪一個，就看它的結尾，再找升高的第 7
          音。曲子幾乎總是結束在主音上，低音也是主音：結束在 A、低音是 A 的是 A 小調，結束在 C 的是
          C 大調。譜裡一再出現 G♯，也就是升高的第 7 音，就表示是 A 小調；C 大調用不到它。
        </p>
        <Plate caption="兩個樂句，調號都沒有升降記號。切換一下：A 小調那句結束在 A 上，低音也是 A，途中有 G♯。">
          <TellTheKey
            staffLabel="大譜表上的一個樂句"
            keys={[
              { tonic: 'C', mode: 'major' },
              { tonic: 'A', mode: 'minor' },
            ]}
            labels={[
              { name: 'C 大調', label: '結束在 C 上，低音是 C。沒有 G♯。' },
              { name: 'A 小調', label: '結束在 A 上，低音是 A，前面有 G♯：升高的第 7 音。' },
            ]}
          />
        </Plate>
        <p>
          C 小調不是 C 大調的關係小調，而是它的<strong>平行小調</strong>
          （也叫同主音小調）：主音相同，調號不同。C 小調有三個降記號：B♭ E♭
          A♭。本課開頭的〈兩隻老虎〉，就是從 C 大調換到了它的平行小調。
        </p>
      </Section>

      <Section id="try-it" title="試一試">
        <p>先看調號找出關係小調，再彈一條和聲小調音階，然後分辨三種小調，最後認出幾個樂句的調。</p>
        <Plate>
          <KeyQuiz
            range={RANGE}
            anyOctave
            items={RELATIVES.map(([tonic, key]) => ({
              key,
              ask: '這個調號的小調：彈出它的主音。',
              figure: <SignatureCard tonic={tonic} label="一個調號" />,
            }))}
          />
        </Plate>
        <p>
          用右手彈 A
          和聲小調，上行再下行，照著鍵上標的指法彈。上行時大拇指在三指之後從下方穿過去，落在 D 上。
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={A_HARMONIC.keys}
            fingers={A_HARMONIC.fingers}
            prompt="A 和聲小調，右手，上行再下行：注意 G♯。"
          />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="是哪一種小調？" questions={WHICH_MINOR} />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="這個樂句是什麼調？" questions={WHICH_KEY} onComplete={complete} />
        </Plate>
        <p>
          dacapo
          的「音階」練習裡，每個小調都有自然、和聲、旋律三種形式，一到四個八度，雙手都可以，和聲小調和旋律小調還附有哈農的指法。
        </p>
      </Section>
    </>
  );
}
