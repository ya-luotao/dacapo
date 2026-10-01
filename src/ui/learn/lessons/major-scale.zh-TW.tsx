import { ChoiceQuiz, SequenceExercise } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { majorScaleRun } from '../notes.ts';
import { KeySignatures, ScaleBuilder, SignatureCard } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [53, 83]; // F3–B5
const G_MAJOR = majorScaleRun('G');
const F_MAJOR = majorScaleRun('F');
const KEYS = ['C 大調', 'G 大調', 'D 大調', 'F 大調', '降 B 大調'];
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
        音階是一座梯子：從一個鍵一級一級往上，直到高八度的同名音。大調音階是大多數旋律的原料，而且不管從哪個鍵開始，所有大調音階的構造都一樣。
      </p>

      <Section id="pattern" title="全、全、半、全、全、全、半">
        <p>
          從 C 彈到 C，只彈白鍵：C D E F G A B
          C。再量一量每一步：全音、全音、半音（E–F）、全音、全音、全音、半音（B–C）。這個規律
          <em>就是</em>
          大調音階。
        </p>
        <p>
          從別的鍵開始，照同樣的規律走，就得到那個調的大調音階。從 G 開始，這個規律要用 F♯ 取代
          F；從 F 開始，要用 B♭ 取代 B。
        </p>
        <Plate wide caption="選一個調：鍵盤標出音階，上面一排顯示每一步，點「聽聽看」就彈給你聽。">
          <ScaleBuilder
            staffLabel="高音譜表上的大調音階"
            labels={{
              tonic: '調',
              accidentals: '寫升降記號',
              signature: '用調號',
              steps: '音階的每一步',
              whole: '全',
              half: '半',
            }}
          />
        </Plate>
        <Aside title="每個字母用一次">
          <p>
            大調音階裡七個字母各用一次，不多也不少。所以 G 大調裡是 F♯ 而不是 G♭：G
            已經被主音自己用掉了。
          </p>
        </Aside>
      </Section>

      <Section id="key-signature" title="調號">
        <p>
          一首 G 大調的曲子，本來每個 F
          前面都要寫升記號。實際上，升記號只在每一行開頭、緊接在譜號後面寫一次，這就是
          <strong>調號</strong>。它的意思是：除非有還原記號，所有八度的 F 都是 F♯。
        </p>
        <p>
          升記號總是照同一個順序加上去：<strong>F C G D A E B</strong>；降記號的順序正好相反：
          <strong>B E A D G C F</strong>。G 大調一個升記號，D 大調兩個；F 大調一個降記號，降 B
          大調兩個。
        </p>
        <Plate caption="七個調的調號，寫在大譜表上。在上面的音階圖裡切換到「用調號」，可以看到音符前的升降記號消失了。">
          <KeySignatures staffLabel="大譜表上的調號" none="沒有升降記號" />
        </Plate>
        <Aside title="看調號認調">
          <p>
            升記號的調：最後一個升記號往上半音就是主音，F♯ 是 G 大調，C♯ 是 D
            大調。降記號的調：倒數第二個降記號就是主音，B♭ E♭ 是降 B 大調。只有一個降記號的是 F
            大調，直接記住。
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="試一試">
        <p>
          用右手彈兩條音階，上行再下行，照著鍵上標的指法彈。上行時大拇指要從下方穿過去彈下一個鍵：G
          大調在三指之後，F 大調在四指（B♭）之後。
        </p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={G_MAJOR.keys}
            fingers={G_MAJOR.fingers}
            prompt="G 大調，右手，上行再下行。"
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={F_MAJOR.keys}
            fingers={F_MAJOR.fingers}
            prompt="F 大調，右手：注意 B♭。"
          />
        </Plate>
        <Plate>
          <ChoiceQuiz
            prompt="這個調號是哪個大調？"
            questions={SIGNATURES.map(([tonic, answer]) => ({
              id: tonic,
              figure: <SignatureCard tonic={tonic} label="一個調號" />,
              options: KEYS,
              answer,
            }))}
            onComplete={complete}
          />
        </Plate>
        <p>
          dacapo
          的「音階」練習走得更遠：所有大調和小調，一到四個八度，雙手都可以，還會測出你彈得有多均勻。
        </p>
      </Section>
    </>
  );
}
