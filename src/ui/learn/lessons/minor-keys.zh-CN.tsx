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
  tonic: '调',
  natural: '自然小调',
  harmonic: '和声小调',
  melodic: '旋律小调',
  accidentals: '写升降号',
  signature: '用调号',
  steps: '音阶的每一步',
  up: '上行的每一步',
  down: '下行的每一步',
  whole: '全',
  half: '半',
  augmented: '增二',
};

// 一个大调的调号，和它的关系小调的主音。
const RELATIVES: readonly [string, number][] = [
  ['G', 64], // E
  ['F', 62], // D
  ['D', 59], // B
  ['C', 69], // A
  ['Bb', 67], // G
  ['A', 66], // F♯
  ['Eb', 60], // C
];

const KINDS = ['自然小调', '和声小调', '旋律小调'];
const KIND_INDEX: Record<MinorKind, number> = {
  naturalMinor: 0,
  harmonicMinor: 1,
  melodicMinor: 2,
};
const SEEN = '谱上写的是哪一种小调音阶？';
const HEARD = '听一听：这是哪一种小调音阶？';
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
  figure: seen ? <MinorScaleCard kind={kind} tonic={tonic} label="一条小调音阶" /> : null,
  options: KINDS,
  answer: KIND_INDEX[kind],
  sound: scaleUp(kind, tonic),
}));

const WHICH_KEY: readonly ChoiceQuestion[] = (
  [
    ['A', 'minor', ['C 大调', 'A 小调']],
    ['G', 'major', ['G 大调', 'E 小调']],
    ['D', 'minor', ['F 大调', 'D 小调']],
    ['D', 'major', ['D 大调', 'B 小调']],
    ['G', 'minor', ['降 B 大调', 'G 小调']],
    ['F', 'major', ['F 大调', 'D 小调']],
  ] as const
).map(([tonic, mode, options]) => ({
  id: `${tonic}-${mode}`,
  figure: <SnippetCard snippetKey={{ tonic, mode }} label="大谱表上的一个乐句" />,
  sound: phraseIn({ tonic, mode }).sound,
  options,
  answer: mode === 'major' ? 0 : 1,
}));

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        到目前为止，你弹的音阶都是大调。和它成对的是小调，声音更暗、更忧伤，你以后弹的曲子里有不少是小调。每个小调都和一个大调用同样的音，却有自己的「家」；小调音阶还有三种形式。
      </p>

      <Section id="sound" title="小调的声音">
        <p>
          把一首熟悉的曲子弹两遍，一遍大调，一遍小调。《两只老虎》在 C 大调里是 C D E C。换到 C
          小调，只有一个音变了：音阶的第三个音 E 降低半音，成了
          E♭。就这一个键，明亮的曲子一下子暗了下来。
        </p>
        <Plate caption="先用 C 大调听一遍，再切换到 C 小调听一遍。只有 E 变了。">
          <MajorAndMinor
            staffLabel="高音谱表上的《两只老虎》"
            labels={{ major: 'C 大调', minor: 'C 小调' }}
          />
        </Plate>
        <Aside title="马勒也这么做过">
          <p>
            马勒《第一交响曲》的第三乐章，把这首曲子（在德国叫《马丁弟兄》）改成小调、放慢，成了一首葬礼进行曲。
          </p>
        </Aside>
        <p>
          你听到的，是<strong>主音</strong>
          （音阶的第一个音）到第三个音的距离。大调里是四个半音，叫<strong>大三度</strong>
          ；小调里是三个半音，叫<strong>小三度</strong>
          。把主音、三音和五音叠在一起就是一个和弦，它是大是小也是这个原因：C E G
          是大三和弦，听起来明亮；C E♭ G 是小三和弦，听起来忧伤。
        </p>
        <Plate caption="在大调和小调之间切换，听一听三度，再听一听和弦。">
          <ThirdAndChord
            staffLabel="高音谱表上的一个三度和一个和弦"
            labels={{
              major: '大调',
              minor: '小调',
              third: '三度',
              chord: '和弦',
              readout: {
                major: { name: 'C → E', label: '四个半音：大三度' },
                minor: { name: 'C → E♭', label: '三个半音：小三度' },
              },
            }}
          />
        </Plate>
      </Section>

      <Section id="relative" title="关系小调">
        <p>
          再弹一遍白键，不过这次从 A 弹到 A：A B C D E F G A。用的还是 C
          大调那七个音，听起来却是小调，因为现在家在 A。这就是 A 小调，C 大调的
          <strong>关系小调</strong>。
        </p>
        <p>
          每个大调都有一个关系小调。它从大调音阶的第 6
          个音开始；也可以从大调的主音往下数一个小三度：C、B、A。两个调的音完全一样，所以调号也一样。
        </p>
        <Plate
          wide
          caption="选一个大调，听它的音阶；再切换到它的关系小调。音和调号都不变，变的只是从哪个音开始。"
        >
          <RelativeMinor
            staffLabel="带调号的大调音阶或它的关系小调"
            labels={{
              key: '大调',
              majorName: '{tonic} 大调',
              minorName: '{tonic} 小调',
              readout: {
                major: '{minor} 小调从 {major} 大调的第 6 个音开始。',
                minor: '和 {major} 大调同样的音、同样的调号，从 {minor} 到 {minor}。',
              },
            }}
          />
        </Plate>
        <Aside title="往下三个半音">
          <p>
            找一个大调的关系小调：从主音往下数三个半音，字母往下数两个。G 大调对应 E 小调，F
            大调对应 D 小调。反过来，从小调的主音往上三个半音，就是它的关系大调。
          </p>
        </Aside>
      </Section>

      <Section id="natural" title="自然小调">
        <p>
          从 A 到 A、一个音都不改，就是<strong>自然小调</strong>
          音阶。像量大调音阶那样量一量每一步：全、半、全、全、半、全、全。半音落在别的位置：第 2、3
          个音之间，第 5、6 个音之间。正是这一点让它听起来是小调。
        </p>
        <p>
          从任何一个键开始，照这个规律走，就得到那个调的自然小调。从 E 开始要用 F♯，从 D 开始要用
          B♭：和它们的关系大调 G 大调、F 大调一样。
        </p>
        <Plate
          wide
          caption="选一个调和一种小调：上面一排显示每一步，键盘标出音阶。比自然小调升高的音标了颜色。切换到「用调号」，只写调号没有给出的升降号。"
        >
          <MinorScaleBuilder staffLabel="高音谱表上的小调音阶" labels={BUILDER} />
        </Plate>
      </Section>

      <Section id="harmonic" title="和声小调">
        <p>
          把 A 自然小调弹到顶，注意听最后一步，G 到
          A。这是一个全音，音阶像是慢慢晃回家，而不是一步到家。把第 7 个音升高半音，变成
          G♯，最后一步就成了半音：G♯ 紧贴着 A，就像 C 大调里 B 紧贴着 C。比主音低半音的第 7 音叫
          <strong>导音</strong>，因为它把耳朵引向主音。
        </p>
        <p>
          第 7 音升高的自然小调，就是<strong>和声小调</strong>。它的名字来自和声：A
          小调的曲子结尾，最后一个和弦之前那个建在 E 上的和弦，要有 G♯
          才有结束感。大多数小调曲子都会这样升高第 7 音，所以谱上会经常见到它。
        </p>
        <Plate caption="在 G 和 G♯ 之间切换，听一听音阶最后几个音，再听一听 A 小调乐曲结尾的两个和弦。">
          <LeadingNote
            staffLabel="A 小调音阶的最后几个音和两个和弦"
            labels={{
              natural: 'G：自然小调',
              raised: 'G♯：和声小调',
              scale: '音阶最后几个音',
              chords: '两个和弦',
              readout: {
                natural: { name: 'G → A', label: '全音：慢慢晃回家。' },
                raised: { name: 'G♯ → A', label: '半音：这就是导音。F → G♯ 是增二度。' },
              },
            }}
          />
        </Plate>
        <p>
          升高第 7 音之后，它下面留出一个大空当：F 到 G♯ 有三个半音，比全音还多一个半音，叫
          <strong>增二度</strong>
          。弹音阶时这里听起来像一个小小的跳跃。在上面的音阶图里选「和声小调」，就能看到整个规律：全、半、全、全、半、增二、半。
        </p>
      </Section>

      <Section id="melodic" title="旋律小调">
        <p>
          增二度唱起来别扭，所以往上走到主音的旋律，常常把第 6 音也升高：A 小调里就是 F♯ 和 G♯。
          <strong>旋律小调</strong>上行是：全、半、全、全、全、全、半，和 A 大调只差第三个音。
        </p>
        <p>
          下行时用不着导音，两个音都还原：先 G，再 F。旋律小调下行就是自然小调，dacapo
          的「音阶」练习也是这样弹的。
        </p>
        <Plate
          wide
          caption="旋律小调上行升高第 6、第 7 音，下行还原。换个调试试：D 小调上行时，B♭ 变成 B，C 变成 C♯。"
        >
          <MinorScaleBuilder
            initial="melodicMinor"
            staffLabel="高音谱表上的旋律小调，上行再下行"
            labels={BUILDER}
          />
        </Plate>
        <Aside title="三种小调，一个调">
          <p>
            一首曲子用的是哪一种小调？三种都用：它们是同一个调，比如 A 小调，调号也相同。第 6、第 7
            音随旋律的需要升高或还原，升高的音总是用临时记号写出来。
          </p>
        </Aside>
      </Section>

      <Section id="signatures" title="小调的调号">
        <p>
          小调用它关系大调的调号。A 小调没有升降号，和 C 大调一样；E 小调一个升号，和 G 大调一样；D
          小调一个降号，和 F 大调一样。升高的第 6、第 7
          音从来不写进调号，出现在哪里，就在哪里写临时记号。
        </p>
        <p>
          所以同一个调号对应两个调。要分辨一首曲子是哪一个，就看它的结尾，再找升高的第 7
          音。曲子几乎总是结束在主音上，低音也是主音：结束在 A、低音是 A 的是 A 小调，结束在 C 的是
          C 大调。谱里一再出现 G♯，也就是升高的第 7 音，说明是 A 小调；C 大调用不着它。
        </p>
        <Plate caption="两个乐句，调号都没有升降号。切换一下：A 小调那句结束在 A 上，低音也是 A，途中有 G♯。">
          <TellTheKey
            staffLabel="大谱表上的一个乐句"
            keys={[
              { tonic: 'C', mode: 'major' },
              { tonic: 'A', mode: 'minor' },
            ]}
            labels={[
              { name: 'C 大调', label: '结束在 C 上，低音是 C。没有 G♯。' },
              { name: 'A 小调', label: '结束在 A 上，低音是 A，前面有 G♯：升高的第 7 音。' },
            ]}
          />
        </Plate>
        <p>
          C 小调不是 C 大调的关系小调，而是它的<strong>同主音小调</strong>
          ：主音相同，调号不同。C 小调有三个降号：B♭ E♭ A♭。本课开头的《两只老虎》，就是从 C
          大调换到了它的同主音小调。
        </p>
      </Section>

      <Section id="try-it" title="试一试">
        <p>先看调号找出关系小调，再弹一条和声小调音阶，然后分辨三种小调，最后认出几个乐句的调。</p>
        <Plate>
          <KeyQuiz
            range={RANGE}
            anyOctave
            items={RELATIVES.map(([tonic, key]) => ({
              key,
              ask: '这个调号的小调：弹出它的主音。',
              figure: <SignatureCard tonic={tonic} label="一个调号" />,
            }))}
          />
        </Plate>
        <p>
          用右手弹 A
          和声小调，上行再下行，照着键上标的指法弹。上行时大拇指在三指之后从下面穿过去，落在 D 上。
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={A_HARMONIC.keys}
            fingers={A_HARMONIC.fingers}
            prompt="A 和声小调，右手，上行再下行：注意 G♯。"
          />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="是哪一种小调？" questions={WHICH_MINOR} />
        </Plate>
        <Plate>
          <ChoiceQuiz prompt="这个乐句是什么调？" questions={WHICH_KEY} onComplete={complete} />
        </Plate>
        <p>
          dacapo
          的「音阶」练习里，每个小调都有自然、和声、旋律三种形式，一到四个八度，双手都可以，和声小调和旋律小调还附有哈农的指法。
        </p>
      </Section>
    </>
  );
}
