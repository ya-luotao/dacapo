import { ChoiceQuiz, SequenceExercise } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { majorScaleRun } from '../notes.ts';
import { KeySignatures, ScaleBuilder, SignatureCard } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [53, 83]; // F3–B5
const G_MAJOR = majorScaleRun('G');
const F_MAJOR = majorScaleRun('F');
const KEYS = ['C 大调', 'G 大调', 'D 大调', 'F 大调', '降 B 大调'];
const SIGNATURES: readonly [string, number][] = [
  ['G', 1],
  ['F', 3],
  ['D', 2],
  ['Bb', 4],
  ['C', 0],
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        音阶是一架梯子：从一个键一级级往上，直到高八度的同名音。大调音阶是大多数旋律的原料，而且从任何一个键开始，所有大调音阶都是同一种造法。
      </p>

      <Section id="pattern" title="全、全、半、全、全、全、半">
        <p>
          从 C 弹到 C，只弹白键：C D E F G A B
          C。再量一量每一步：全音、全音、半音（E–F）、全音、全音、全音、半音（B–C）。这个规律
          <em>就是</em>
          大调音阶。
        </p>
        <p>
          从别的键开始，照同样的规律走，就得到那个调的大调音阶。从 G 开始，这个规律要求用 F♯ 代替
          F；从 F 开始，要用 B♭ 代替 B。
        </p>
        <Plate wide caption="选一个调：键盘标出音阶，上面一排显示每一步，点「听一听」弹给你听。">
          <ScaleBuilder
            staffLabel="高音谱表上的大调音阶"
            labels={{
              tonic: '调',
              accidentals: '写升降号',
              signature: '用调号',
              steps: '音阶的每一步',
              whole: '全',
              half: '半',
            }}
          />
        </Plate>
        <Aside title="每个字母用一次">
          <p>
            大调音阶里七个字母各用一次，不多不少。所以 G 大调里是 F♯ 而不是 G♭：G
            已经被主音自己占用了。
          </p>
        </Aside>
      </Section>

      <Section id="key-signature" title="调号">
        <p>
          一首 G 大调的曲子，本来每个 F
          前面都要写升号。实际上升号只在每一行开头、紧跟谱号写一次，这就是<strong>调号</strong>
          。它的意思是：除非有还原号，所有八度的 F 都是 F♯。
        </p>
        <p>
          升号总是按同一个顺序添加：<strong>F C G D A E B</strong>；降号的顺序正好相反：
          <strong>B E A D G C F</strong>。G 大调一个升号，D 大调两个；F 大调一个降号，降 B
          大调两个。
        </p>
        <Plate caption="七个调的调号，写在大谱表上。在上面的音阶图里切换到「用调号」，可以看到音符前的升降号消失了。">
          <KeySignatures staffLabel="大谱表上的调号" none="没有升降号" />
        </Plate>
        <Aside title="看调号认调">
          <p>
            升号调：最后一个升号往上半音就是主音，F♯ 是 G 大调，C♯ 是 D
            大调。降号调：倒数第二个降号就是主音，B♭ E♭ 是降 B 大调。只有一个降号的是 F
            大调，直接记住。
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="试一试">
        <p>
          用右手弹两条音阶，上行再下行，照着键上标的指法弹。上行时大拇指要从下面穿过去弹下一个键：G
          大调在三指之后，F 大调在四指（B♭）之后。
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={G_MAJOR.keys}
            fingers={G_MAJOR.fingers}
            prompt="G 大调，右手，上行再下行。"
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={F_MAJOR.keys}
            fingers={F_MAJOR.fingers}
            prompt="F 大调，右手：注意 B♭。"
          />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="这个调号是哪个大调？"
            questions={SIGNATURES.map(([tonic, answer]) => ({
              id: tonic,
              figure: <SignatureCard tonic={tonic} label="一个调号" />,
              options: KEYS,
              answer,
            }))}
            onComplete={complete}
          />
        </Plate>
        <p>
          dacapo
          的「音阶」练习走得更远：所有大调和小调，一到四个八度，双手都可以，还会测出你弹得有多均匀。
        </p>
      </Section>
    </>
  );
}
