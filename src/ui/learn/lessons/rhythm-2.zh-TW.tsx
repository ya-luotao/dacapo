import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  CompoundTime,
  RhythmLine,
  RhythmRows,
  RhythmTap,
  ValueCard,
  type Beat,
} from '../rhythmFigures.tsx';

const h: Beat = { duration: 'half' };
const q: Beat = { duration: 'quarter' };
const e: Beat = { duration: 'eighth' };
const s: Beat = { duration: 'sixteenth' };
const t: Beat = { duration: 'eighth', triplet: true };
const hd: Beat = { duration: 'half', dotted: true };
const qd: Beat = { duration: 'quarter', dotted: true };
const ed: Beat = { duration: 'eighth', dotted: true };
const qT: Beat = { duration: 'quarter', tie: true };
const eT: Beat = { duration: 'eighth', tie: true };
const sr: Beat = { duration: 'sixteenth', rest: true };
const qdr: Beat = { duration: 'quarter', dotted: true, rest: true };

const HOW_LONG = '它持續幾拍？';
const WHICH_COUNT = '標了顏色的音彈在哪一個數上？';

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'dotted-quarter',
    question: HOW_LONG,
    figure: <ValueCard beat={qd} label="附點四分音符" />,
    options: ['¾', '1', '1½', '2'],
    answer: 2,
  },
  {
    id: 'sixteenth',
    question: HOW_LONG,
    figure: <ValueCard beat={s} label="十六分音符" />,
    options: ['¼', '½', '¾', '1'],
    answer: 0,
  },
  {
    id: 'sixteenth-rest',
    question: HOW_LONG,
    figure: <ValueCard beat={sr} label="十六分休止符" />,
    options: ['¼', '½', '¾', '1'],
    answer: 0,
  },
  {
    id: 'dotted-eighth',
    question: HOW_LONG,
    figure: <ValueCard beat={ed} label="附點八分音符" />,
    options: ['¼', '½', '¾', '1'],
    answer: 2,
  },
  {
    id: 'e-s-s',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[e, s, s, q]}
        time={[2, 4]}
        counts={false}
        current={2}
        label="前八後十六和一個四分音符，第二個十六分音符標了顏色"
      />
    ),
    options: ['1', 'e', '&', 'a'],
    answer: 3,
  },
  {
    id: 'triplet',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[t, t, t, q]}
        time={[2, 4]}
        counts={false}
        current={2}
        label="一組三連音和一個四分音符，三連音的第三個音標了顏色"
      />
    ),
    options: ['1', '連', '音', '2'],
    answer: 2,
  },
  {
    id: 'syncopation',
    question: WHICH_COUNT,
    figure: (
      <RhythmLine
        rhythm={[e, q, e]}
        time={[2, 4]}
        counts={false}
        current={1}
        label="八分、四分、八分，四分音符標了顏色"
      />
    ),
    options: ['1', '1 &', '2', '2 &'],
    answer: 1,
  },
  {
    id: 'six-eight',
    question: '6/8 拍的一小節有幾拍？',
    figure: (
      <RhythmLine
        rhythm={[e, e, e, e, e, e]}
        time={[6, 8]}
        counts={false}
        label="6/8 拍的一小節，六個八分音符"
      />
    ),
    options: ['2', '3', '6'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        上一堂節奏課只用到整拍和半拍。真正的音樂會把一拍分得更細，會把音延續過拍子，有時還故意和拍子錯開。這一課補上讀懂大多數初級樂曲的節奏所需要的東西。
      </p>

      <Section id="dotted" title="再談附點">
        <p>
          附點讓音符再延長一半。附點二分音符你已經學過：2 + 1 = 3 拍。
          <strong>附點四分音符</strong>也一樣：1 + ½ = 1½ 拍。
        </p>
        <p>
          它後面幾乎總是跟著一個八分音符，把第二拍剩下的一半補滿。數作「1 (2) & 3」：在 1 上彈，2
          的時候繼續按住，到 2 後面的「and」再彈下一個音。這裡節奏下面帶括號的數，是要數但不彈的。
        </p>
        <Plate
          wide
          caption="附點四分音符一直延續過第 2 拍，八分音符落在它後面的「and」上。先聽，再跟著數。"
        >
          <RhythmRows
            bracket
            rows={[
              { title: '附點二分音符、四分音符', rhythm: [hd, q] },
              { title: '附點四分音符、八分音符，兩次', rhythm: [qd, e, qd, e] },
              { title: '附點四分音符、八分音符、二分音符', rhythm: [qd, e, h] },
            ]}
          />
        </Plate>
        <Aside title="按住，別空等">
          <p>最常見的毛病是太早放手，然後空等。帶括號的那一拍要一直按著鍵，讓聲音連到八分音符。</p>
        </Aside>
      </Section>

      <Section id="ties" title="連結線">
        <p>
          <strong>連結線</strong>
          是連接兩個相同音高的音符的弧線。彈第一個，然後按住，時值是兩個加起來那麼長；第二個不再重新彈。
        </p>
        <p>
          連結線能做到附點做不到的事：把音延續過拍子，甚至越過小節線，這些地方用一個音符寫不出來。四分音符用連結線連上一個八分音符，聽起來和附點四分音符完全一樣。
        </p>
        <Plate
          wide
          caption="連在一起的兩個音只是一個聲音。第二行和附點四分加八分聽起來一樣；最後一行是 3/4 拍，第 3 拍延續過小節線。"
        >
          <RhythmRows
            bracket
            rows={[
              { title: '兩個四分音符連起來', rhythm: [q, qT, q, q] },
              { title: '四分音符連八分音符', rhythm: [qT, e, e, h] },
              { title: '越過小節線', rhythm: [q, q, qT, q, h], time: [3, 4] },
            ]}
          />
        </Plate>
        <Aside title="連結線還是圓滑線？">
          <p>
            <strong>圓滑線</strong>
            長得和連結線很像，但連的是不同音高的音，意思是彈得連貫，一個音接著一個音。連結線只連同一個音。
          </p>
        </Aside>
      </Section>

      <Section id="sixteenths" title="十六分音符">
        <p>
          <strong>十六分音符</strong>
          有兩條符尾，或者兩道符槓。它是四分之一拍：四個合起來是一拍。數作「1 e & a」：e 唸「伊」，&
          唸「and」，a 唸「啊」。十六分休止符有兩個小鉤子，比八分休止符多一個。
        </p>
        <p>
          十六分音符常常和八分音符合在一拍裡。一個八分加兩個十六分叫<strong>前八後十六</strong>
          ，數「1 & a」；兩個十六分加一個八分叫<strong>前十六後八</strong>，數「1 e &」。
          <strong>附點八分音符</strong>佔三個十六分，所以後面那個十六分落在「a」上，緊貼著下一拍。
        </p>
        <Plate
          wide
          caption="每一行是一小節 2/4 拍。第二道符槓標出十六分音符；短短的一截指向它所屬的那個音。"
        >
          <RhythmRows
            bracket
            bpm={60}
            rows={[
              { title: '一個四分，再四個十六分', rhythm: [q, s, s, s, s], time: [2, 4] },
              { title: '前八後十六', rhythm: [e, s, s, e, s, s], time: [2, 4] },
              { title: '前十六後八', rhythm: [s, s, e, s, s, e], time: [2, 4] },
              { title: '附點八分、十六分', rhythm: [ed, s, ed, s], time: [2, 4] },
            ]}
          />
        </Plate>
        <Aside title="短的要短">
          <p>
            附點八分加十六分很容易彈得鬆散，兩個音差不多一樣長。附點八分要按滿三個十六分，十六分晚一點彈，緊貼著下一拍。
          </p>
        </Aside>
      </Section>

      <Section id="triplets" title="三連音">
        <p>
          有時一拍不是分成兩份，而是三份。上面標著 3 的三個八分音符就是<strong>三連音</strong>
          ：在兩個音的時間裡彈三個音。三個音一樣長，各佔三分之一拍。
        </p>
        <p>
          唸作「1 連 音、2 連
          音」：把「三連音」三個字平均地唸滿一拍，只是第一個字換成拍數。仔細聽兩者的差別：一般的八分音符像齊步走，三連音像在滾動。
        </p>
        <Plate
          wide
          caption="同樣的拍子，先分成兩份，再分成三份，然後兩種輪流。上下幾行的拍子是對齊的。"
        >
          <RhythmRows
            bracket
            spacing={88}
            rows={[
              { title: '八分音符：一拍兩個', rhythm: [e, e, e, e], time: [2, 4] },
              { title: '三連音：一拍三個', rhythm: [t, t, t, t, t, t], time: [2, 4] },
              { title: '先兩個，再三個', rhythm: [e, e, t, t, t], time: [2, 4] },
            ]}
          />
        </Plate>
        <Aside title="三個一樣長">
          <p>
            三連音不是兩個快的加一個慢的。跟著節拍聲，每個數字響一下，平均地唸「1 連
            音」，讓三個音正好填滿一拍。
          </p>
        </Aside>
      </Section>

      <Section id="syncopation" title="切分音">
        <p>
          重要的音通常從拍子上開始。<strong>切分音</strong>
          把它挪開：一個較長的音從兩拍之間開始，重音就落在你意想不到的地方。散拍音樂（ragtime）、爵士和很多流行音樂裡到處都是。
        </p>
        <p>
          最常見的是八分、四分、八分：四分音符從第 1 拍的「and」開始，一直延續過第 2
          拍。用連結線把音連過拍子，效果也一樣。兩種寫法在第 2
          拍上都不重新彈，拍子卻照樣在底下走著。
        </p>
        <Plate wide caption="帶括號的數，是那一拍上什麼都不彈：前一個音一直延續過去。">
          <RhythmRows
            bracket
            rows={[
              { title: '八分、四分、八分', rhythm: [e, q, e, e, q, e] },
              { title: '用連結線連過拍子', rhythm: [e, eT, e, e, q, q] },
              { title: '整小節都在拍子之間', rhythm: [e, q, q, q, e] },
            ]}
          />
        </Plate>
        <Aside title="數出聲音來">
          <p>切分音最需要數拍。每個數都唸出來，帶括號的也唸，只在有音符的地方彈。</p>
        </Aside>
      </Section>

      <Section id="six-eight" title="6/8 拍">
        <p>
          <strong>6/8 拍</strong>
          每小節六個八分音符，但不是六拍。它的感覺是兩拍，每拍三個八分音符：「1 2 3 4 5 6」，重音在
          1 和
          4。一拍是一個附點四分音符，正好三個八分音符那麼長；八分音符三個一組連在一起，就是為了讓你看出拍子。
        </p>
        <p>
          3/4 拍每小節也是六個八分音符，只是兩個一組：三拍，每拍兩個八分。音符一樣，拍子不同：3/4
          拍像圓舞曲一樣數三拍，6/8 拍像船歌或搖籃曲一樣兩拍一晃。
        </p>
        <Plate caption="每小節六個八分音符，兩種分組、兩種打拍子的方式。在 3/4 和 6/8 之間切換，聽拍子落在哪裡；加上八分音符的節拍聲，聽它們怎麼分組。">
          <CompoundTime labels={{ clicks: '節拍聲', beats: '只打拍子', eighths: '加上八分音符' }} />
        </Plate>
        <p>
          四分加八分是 6/8
          拍裡一長一短的搖晃感：四分音符佔兩個八分，八分音符佔第三個。附點四分音符佔滿一整拍。
        </p>
        <Plate wide caption="6/8 拍裡八分音符也會響，比拍子輕一些，好讓你把六個都數出來。">
          <RhythmRows
            bracket
            rows={[
              { title: '四分、八分', rhythm: [q, e, q, e], time: [6, 8] },
              { title: '三個八分、附點四分', rhythm: [e, e, e, qd], time: [6, 8] },
              {
                title: '附點四分音符和附點四分休止符',
                rhythm: [qd, qd, e, e, e, qdr],
                time: [6, 8],
              },
            ]}
          />
        </Plate>
      </Section>

      <Section id="try-it" title="試一試">
        <p>先說出新學的音符有多長、落在哪個數上，再跟著拍子把節奏打出來。</p>
        <Plate>
          <ChoiceQuiz prompt="讀一讀這個節奏。" questions={QUESTIONS} />
        </Plate>
        <Plate wide>
          <RhythmTap
            bracket
            bpm={60}
            prompt="邊數拍子，邊在每個音符上隨便按一個鍵。"
            rhythms={[
              [qd, e, q, q],
              [q, qT, e, e, q],
              [e, s, s, e, s, s, q, q],
              [ed, s, ed, s, h],
              [t, t, t, q, t, t, t, q],
              [e, q, e, q, q],
              { rhythm: [q, e, q, e], time: [6, 8] },
            ]}
            onComplete={complete}
          />
        </Plate>
        <p>
          「樂曲」裡的節奏模式會用同樣的方法替真正樂曲裡的每個音計時。新節奏怎麼彈都不順的時候，把「節拍器」調慢，讓它每拍響兩下、三下或四下；它也能打
          6/8 拍。
        </p>
      </Section>
    </>
  );
}
