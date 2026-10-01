import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { LegatoPedalling, PedalExercise, PedalledChords } from '../pedalFigures.tsx';

const USES = {
  none: '不踩踏板',
  held: '一直踩著',
  changed: '隨和弦換',
  signs: 'Ped. 和 ✱',
  line: '線條',
};

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'dampers',
    question: '哪個踏板會把所有制音器從琴弦上抬起來？',
    figure: null,
    options: ['左踏板', '中踏板', '右踏板'],
    answer: 2,
  },
  {
    id: 'una-corda',
    question: '譜上寫著 una corda，是要你做什麼？',
    figure: null,
    options: ['踩左踏板', '踩右踏板', '只用一根手指彈'],
    answer: 0,
  },
  {
    id: 'star',
    question: '譜表下方，Ped. 之後的 ✱ 是什麼意思？',
    figure: null,
    options: ['放開踏板', '踩下踏板', '這個音彈得更大聲'],
    answer: 0,
  },
  {
    id: 'notch',
    question: '踏板線上的一個尖角是什麼意思？',
    figure: null,
    options: ['放開再馬上踩下：換一次踏板', '放開踏板，不再踩', '踩一半'],
    answer: 0,
  },
  {
    id: 'when-up',
    question: '切分踏板裡，踏板什麼時候放開？',
    figure: null,
    options: ['新和弦彈下去之後馬上放', '新和弦彈下去之前', '小節線的地方'],
    answer: 0,
  },
  {
    id: 'early',
    question: '還沒彈新和弦就先放開踏板，會聽到什麼？',
    figure: null,
    options: ['聲音斷開了', '兩個和弦混在一起', '沒有差別'],
    answer: 0,
  },
  {
    id: 'late',
    question: '新和弦彈了很久才放開踏板，會聽到什麼？',
    figure: null,
    options: ['兩個和弦混在一起', '聲音斷開了', '和弦變輕了'],
    answer: 0,
  },
  {
    id: 'harmony',
    question: '通常什麼時候換踏板？',
    figure: null,
    options: ['和聲改變的時候', '每一拍', '只在曲子結尾'],
    answer: 0,
  },
  {
    id: 'heel',
    question: '踩踏板時，腳跟放在哪裡？',
    figure: null,
    options: ['地板上', '踏板上', '懸在空中'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        平台鋼琴有三個踏板，其中右邊那個，蕭邦以後的曲子幾乎每一首都要用。用得好，它能把手連不起來的音連起來，讓整台鋼琴共鳴；用得隨便，它會把一切都攪成一團。這一課講每個踏板做什麼，以及怎麼乾淨地換右踏板。
      </p>

      <Section id="three-pedals" title="三個踏板">
        <ul>
          <li>
            <strong>右邊：延音踏板</strong>，也叫制音踏板。它把所有制音器一起從琴弦上抬起來（見
            <Link href="/learn/inside">「鋼琴裡面是什麼樣子」</Link>
            ）：放開琴鍵之後，音還在響，別的琴弦也會跟著共鳴。譜上說「踏板」，通常指的就是它。
          </li>
          <li>
            <strong>左邊：弱音踏板</strong>，譜上寫作 <em>una corda</em>
            （「一根弦」）。在平台鋼琴上，它把整個擊弦機往旁邊移一點，每個琴槌就少打一根弦：聲音變輕，音色也變柔。寫著{' '}
            <em>tre corde</em>
            （「三根弦」）就是放開它。在直立式鋼琴上，它讓琴槌離琴弦近一些，只是讓聲音變輕。
          </li>
          <li>
            <strong>中間：持音踏板</strong>
            ，大多數平台鋼琴上有。它只托住踩下時已經抬起的那些制音器：先彈一個低音，踩下中踏板，這個低音就一直響著，後面彈的音照樣清楚。很多直立式鋼琴的中踏板則是練習用的靜音踏板，它在琴槌和琴弦之間放下一條毛氈，讓琴聲變得很小。
          </li>
        </ul>
        <p>
          大多數數位鋼琴有一個延音踏板，有的三個都有。MIDI 鍵盤會像傳送琴鍵一樣，把延音踏板也傳給
          dacapo。
        </p>
        <Aside title="它不是音量旋鈕">
          <p>弱音踏板改變的主要是音色，而不是音量。要彈得輕，還是得靠手指。</p>
        </Aside>
      </Section>

      <Section id="pressing" title="怎麼踩">
        <ul>
          <li>用右腳，腳跟放在踏板前面的地板上。</li>
          <li>用前腳掌踩，動的是腳踝；踏板放開時腳也不離開它，這樣就不會有拍打聲、碰撞聲。</li>
          <li>踩就踩到底，放就放到頂：只踩一半，兩頭都做不好。</li>
          <li>左腳平放在地板上，要用弱音踏板時再移到它旁邊。</li>
        </ul>
      </Section>

      <Section id="marks" title="踏板記號">
        <p>
          延音踏板標在低音譜表下方。早期的樂譜在踩下的地方寫 <em>Ped.</em>
          ，放開的地方畫一個星號
          ✱。較新的樂譜畫一條線：線從踩下的地方開始，線上每個尖角就是一次換踏板，放開再馬上踩下。譜上什麼都沒標的地方，往往也要踩踏板，這要由你和老師來決定。
        </p>
        <Plate caption="同樣的踏板用法，兩種寫法：第一個和弦踩下，每個新和弦換一次，最後放開。">
          <PedalledChords
            uses={['changed']}
            marks={['signs', 'line']}
            labels={USES}
            staffLabel="大譜表上的四個和弦：C、F、G、C，下方標著踏板"
          />
        </Plate>
      </Section>

      <Section id="legato-pedalling" title="換踏板：切分踏板">
        <p>
          要把一個和弦連到下一個和弦，踏板得放掉舊和弦、接住新和弦，中間既不斷開，也不混在一起。訣竅是在新和弦
          <strong>之後</strong>
          換，而不是和它同時：先彈新和弦，手按住不放，再放開踏板、馬上踩下。制音器落下一瞬間，把舊和弦止住；新和弦還在手指下面，正好被踏板接住。
        </p>
        <p>
          腳總是比手晚一點，從不和手同時動：這叫<strong>切分踏板</strong>
          （也叫連音踏板）。新和弦之前就放開踏板，聲音會<strong>斷開</strong>
          ；放得太晚，舊和弦會一直響進新和弦裡，聲音就<strong>混濁</strong>了。
        </p>
        <Plate
          wide
          caption="看四個和弦的三種換法：換得剛好、太早、太晚。最上面是琴鍵，中間是踏板，最下面是你聽到的聲音。用你自己的鍵盤和踏板彈和弦，它就跟著你。"
        >
          <LegatoPedalling
            labels={{ clean: '剛好', early: '太早', late: '太晚', watch: '看看' }}
            readouts={{
              clean: '每個和弦之後馬上放開、馬上踩下：每個和弦都連進下一個，又各自清楚。',
              early: '每個和弦之前就放開：聲音停了，新和弦在一段空白之後才響起來。',
              late: '每個和弦之後很久才放開：舊和弦一直在新和弦下面響著。',
            }}
            live="你的琴鍵和踏板，正在彈。"
          />
        </Plate>
        <Aside title="邊彈邊唸">
          <p>「彈——放、踩。」先和弦，後腳。一個和弦接一個和弦慢慢練，直到腳自己跟著手走。</p>
        </Aside>
      </Section>

      <Section id="when" title="什麼時候換">
        <p>
          和聲一變就換踏板，通常就是低音換了新和弦的時候。在同一個和聲裡一直踩著，這些音會一起共鳴，正是應有的效果；踩進下一個和聲，兩個和弦就混在一起了。
        </p>
        <Plate caption="這四個和弦三種彈法：不踩踏板，一直踩著不放，隨每個和弦換。只有最後一種既連得起來，又清清楚楚。">
          <PedalledChords
            uses={['none', 'held', 'changed']}
            marks={['line']}
            labels={USES}
            readouts={{
              none: '手要離開每個和弦才碰得到下一個：和弦之間有空隙。',
              held: '每個和弦都響進下一個：一片混濁。',
              changed: '每個和弦都被踏板接住，到下一個和弦時放掉：又連又清楚。',
            }}
            staffLabel="大譜表上的四個和弦：C、F、G、C，下方標著踏板"
          />
        </Plate>
        <p>
          程度更高的演奏者還會只把踏板放開一部分，讓制音器輕輕擦過琴弦：這種
          <strong>半踏板</strong>
          讓聲音變薄，又不讓它完全停下。
        </p>
        <p>在踏板會把音樂弄得混濁的地方，就不踩，或者少踩：</p>
        <ul>
          <li>巴哈和他那個時代的大部分音樂，音要靠手指連；</li>
          <li>快速的音階和音群，音會糊成一團；</li>
          <li>斷奏，踏板會把它們又變長。</li>
        </ul>
        <p>不確定的時候就用聽的：聲音濁了，就換得勤一點，或者踩得淺一點。</p>
      </Section>

      <Section id="try-it" title="試一試：四個和弦">
        <p>
          用右手彈這四個和弦，每個和弦之後換一次踏板：第一個和弦之後踩下，之後每個新和弦都是「彈——放、踩」。踏板在和弦之後四分之一秒內放開，0.4
          秒內再踩下，這次換踏板就算乾淨。這需要一個接在 MIDI 鍵盤上的延音踏板。
        </p>
        <Plate>
          <PedalExercise
            prompt="C、F、G、C：彈一個和弦，換一次踏板。"
            skipTo="test-yourself"
            needsPedal="這個練習需要 MIDI 鍵盤上的延音踏板。可以跳過它，做完下面的題目，這一課就完成了。"
            summary="{total} 次換踏板裡，{clean} 次是乾淨的。"
            verdicts={{
              pending: '第 {n} 次：⋯',
              clean: '第 {n} 次：乾淨，和弦之後 {up} 毫秒放開，又過 {down} 毫秒踩下。',
              early: '第 {n} 次：在和弦之前 {ms} 毫秒就放開了，聲音斷開。',
              late: '第 {n} 次：在和弦之後 {ms} 毫秒才放開，聲音混濁。',
              held: '第 {n} 次：到下一個和弦都沒放開，和弦混在一起。',
              slow: '第 {n} 次：過了 {ms} 毫秒才踩下，和弦沒被接住。',
              none: '第 {n} 次：踏板沒有踩著。',
            }}
          />
        </Plate>
      </Section>

      <Section id="test-yourself" title="考考自己">
        <Plate>
          <ChoiceQuiz prompt="關於踏板。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          在「彈奏」頁面上，聲音被踏板延續的琴鍵會一直亮著，你看得到哪些音還在響。在那裡彈任何曲子的和弦，每換一個和弦就換一次踏板。
        </p>
      </Section>
    </>
  );
}
