import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import {
  Accents,
  Articulation,
  Balance,
  CrescendoExercise,
  DynamicLevels,
  Hairpins,
  MarkCard,
  VelocityMeter,
} from '../expressionFigures.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const TOUCHES = {
  legato: {
    name: '連奏',
    text: '下一個鍵按下時，才放開上一個鍵；第一條圓滑線結束的地方換一口氣。',
  },
  nonLegato: { name: '非連奏', text: '每個音彈滿大半個時值，音和音之間稍微分開。' },
  staccato: { name: '斷奏', text: '短：只彈一半時值或更短，其餘是空白。' },
  tenuto: { name: '持音', text: '彈滿整個時值，稍微帶一點重量。' },
};

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'mp-mf',
    question: '哪個比較強？',
    figure: null,
    options: ['mp', 'mf'],
    answer: 1,
  },
  {
    id: 'p-pp',
    question: '哪個比較弱？',
    figure: null,
    options: ['p', 'pp', 'mp'],
    answer: 1,
  },
  {
    id: 'staccato',
    question: '音符上的這個點是什麼意思？',
    figure: <MarkCard mark="staccato" label="上方有一個點的音符" />,
    options: ['彈得短而斷開', '稍微按久一點', '彈得更大聲'],
    answer: 0,
  },
  {
    id: 'dim',
    question: '音符下面的這個記號是什麼意思？',
    figure: <MarkCard hairpin="dim" label="四個音符，下面是一個收口的楔形記號" />,
    options: ['逐漸變強', '逐漸變弱', '第一個音彈得更大聲'],
    answer: 1,
  },
  {
    id: 'accent',
    question: '那一個音符上的這個記號呢？',
    figure: <MarkCard mark="accent" label="上方有重音記號的音符" />,
    options: ['這個音比周圍的音更大聲', '逐漸變弱', '彈滿整個時值'],
    answer: 0,
  },
  {
    id: 'tenuto',
    question: '音符上的這條短線是什麼意思？',
    figure: <MarkCard mark="tenuto" label="上方有一條短橫線的音符" />,
    options: ['彈滿整個時值', '彈得短', '彈得輕'],
    answer: 0,
  },
  {
    id: 'relative',
    question: 'f 到底有多大聲？',
    figure: null,
    options: ['永遠是同樣的音量', '在這首曲子、這台琴上算大聲'],
    answer: 1,
  },
  {
    id: 'balance',
    question: '右手彈旋律，左手彈和弦：哪個應該比較大聲？',
    figure: null,
    options: ['旋律', '和弦', '一樣大聲'],
    answer: 0,
  },
  {
    id: 'slur-end',
    question: '一條圓滑線結束的地方該怎麼彈？',
    figure: null,
    options: ['手稍微抬起，樂句換一口氣', '最後一個音按得更久', '最後一個音彈得更大聲'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        同樣的音，可以彈得大聲，也可以彈得輕；可以連成一片，也可以一個個分開。樂譜會把這兩樣都標出來，而「彈出音符」和「彈出音樂」之間的差別，很大一部分就在這裡。這一課教你讀這些記號，並且親耳聽一聽；如果你有
        MIDI 鍵盤，還能看到自己是怎麼彈的。
      </p>

      <Section id="loud-and-soft" title="強與弱">
        <p>
          表示強弱的詞來自義大利文。<strong>piano</strong> 是「弱」，<strong>forte</strong>{' '}
          是「強」：鋼琴的全名
          pianoforte，意思就是「能弱也能強」。譜上用它們的縮寫表示，寫在譜表下方，是粗斜體的字母。這些叫
          <strong>力度記號</strong>。
        </p>
        <ul>
          <li>
            <strong>pp</strong>，pianissimo：甚弱
          </li>
          <li>
            <strong>p</strong>，piano：弱
          </li>
          <li>
            <strong>mp</strong>，mezzo-piano：中弱
          </li>
          <li>
            <strong>mf</strong>，mezzo-forte：中強
          </li>
          <li>
            <strong>f</strong>，forte：強
          </li>
          <li>
            <strong>ff</strong>，fortissimo：甚強
          </li>
        </ul>
        <p>
          一個力度記號一直管到下一個出現為止。它們是相對的，不是精確的音量：搖籃曲裡的 f
          比進行曲裡的 f 溫和得多，你的琴、你的房間也會讓它們不一樣。重要的是一級和一級之間的差別。
        </p>
        <Plate caption="選一個力度記號，點「聽聽看」：同一個樂句，時弱時強。第二個按鈕把第一小節從 pp 到 ff 依序彈一遍。">
          <DynamicLevels
            staffLabel="高音譜表上〈快樂頌〉的開頭，下方有一個力度記號"
            labels={{
              all: '從 pp 到 ff',
              levels: {
                pp: { name: 'pianissimo', meaning: '甚弱' },
                p: { name: 'piano', meaning: '弱' },
                mp: { name: 'mezzo-piano', meaning: '中弱' },
                mf: { name: 'mezzo-forte', meaning: '中強' },
                f: { name: 'forte', meaning: '強' },
                ff: { name: 'fortissimo', meaning: '甚強' },
              },
            }}
          />
        </Plate>
        <p>
          在鋼琴上，聲音大不大取決於琴鍵按下去有多快：按得越快，琴槌打得越重（原因見
          <Link href="/learn/inside">「鋼琴裡面是什麼樣子」</Link>）。MIDI 鍵盤會測出這個速度，用 1
          到 127 的數字送出來，叫作<strong>力度值</strong>
          （velocity）。
        </p>
        <Plate caption="彈幾個音，有的輕、有的重：每一根長條就是你按下一個鍵的力度。">
          <VelocityMeter label="你剛彈的那個音" />
        </Plate>
        <Aside title="弱比強難">
          <p>彈得又輕又均勻，比彈得大聲難得多。指尖貼著琴鍵，慢一點按下去，但一定要按到底。</p>
        </Aside>
      </Section>

      <Section id="louder-and-softer" title="漸強與漸弱">
        <p>
          <strong>漸強</strong>（crescendo，寫作 <em>cresc.</em>）是逐漸變強；
          <strong>漸弱</strong>（diminuendo，寫作 <em>dim.</em>，也寫作 decrescendo、
          <em>decresc.</em>
          ）是逐漸變弱。文字後面跟一條虛線，一直畫到變化結束的地方。同樣的意思也常畫成一個細長的楔形：開口越來越大是漸強，越來越小是漸弱。
        </p>
        <Plate caption="同一個起伏的兩種寫法：一路強到 G，再弱回來。聽聽聲音怎麼漲起來、落下去。">
          <Hairpins
            staffLabel="九個音符上行到 G 再回來，下方有漸強和漸弱記號"
            labels={{ hairpins: '楔形記號', words: '文字' }}
          />
        </Plate>
        <Aside title="替漸強留餘地">
          <p>
            漸強要從夠弱的地方開始，才有地方可去。兩個音就已經很大聲了，到後面就沒有可以再強的了。
          </p>
        </Aside>
      </Section>

      <Section id="accents" title="重音">
        <p>
          <strong>重音記號</strong>
          是寫在音符上方或下方的一個小「&gt;」，要這一個音比周圍的音更大聲。
          <strong>sf</strong> 或 <strong>sfz</strong>
          （sforzando，<strong>突強</strong>
          ）是突然的、強烈的重音，常常出現在一段弱的音樂當中。彈完它，馬上回到原來的力度。
        </p>
        <p>別把重音記號和漸弱記號搞混：重音記號很小，只管一個音；漸弱記號橫跨好幾個音。</p>
        <Plate caption="重音讓輕聲的旋律裡有兩個音跳出來；sf 則是一個突然、有力的音。">
          <Accents
            staffLabel="C 大三和弦的九個音，上行再下行，標著弱，帶有重音記號或 sf"
            labels={{ accents: '重音', sf: 'sf' }}
          />
        </Plate>
      </Section>

      <Section id="balance" title="旋律蓋過和弦">
        <p>
          兩隻手一起彈的時候，它們很少是平等的。一個聲部唱旋律，其餘的替它伴奏，所以旋律要浮在上面：它的音比同時按下的和弦稍微大聲一點，就算兩者標的是同一個力度。這叫作
          <strong>聲部平衡</strong>。旋律通常是右手最上面的那個音，左手要彈得輕一些。
        </p>
        <Plate caption="〈快樂頌〉配上和弦，三種彈法。只有第一種是對的：旋律清楚，和弦在它下面。">
          <Balance
            staffLabel="大譜表上的〈快樂頌〉，高音譜表是旋律，低音譜表是和弦"
            labels={{ balanced: '旋律在上', even: '一樣響', under: '和弦在上' }}
            readouts={{
              balanced: '旋律比和弦大聲：它在和弦上面唱出來。',
              even: '所有的音一樣響：旋律淹沒在和弦裡。',
              under: '和弦比旋律大聲：旋律很難聽清楚。',
            }}
          />
        </Plate>
        <Aside title="先分手練">
          <p>先單獨彈旋律，再單獨彈和弦，只用一半的力度。然後合起來，保持住這個差別。</p>
        </Aside>
      </Section>

      <Section id="legato" title="連起來：連奏">
        <p>
          <strong>連奏</strong>
          （legato，義大利文「連起來」）是每個音和下一個音連在一起，中間沒有空隙。在鋼琴上，這要靠手指：下一個鍵按下去的同時，放開上一個鍵，像走路一樣，一隻腳落地，另一隻腳才離開地面。
        </p>
        <p>
          <strong>圓滑線</strong>
          （也叫連線）是畫在幾個不同音高的音符上方或下方的弧線，要求這幾個音連奏。它還把音符組成一個
          <strong>樂句</strong>
          ，就像幾個字組成一句話。一條圓滑線結束的地方，手稍微抬起：最後一個音略短一點，音樂換一口氣，再開始下一句。
        </p>
        <p>
          既沒有圓滑線、也沒有記號的音，要彈滿大半個時值。連得多緊要看音樂：彈巴哈時常常稍微分開，叫作
          <strong>非連奏</strong>（non legato）；更晚的音樂裡，通常幾乎是連著的。
        </p>
        <Plate caption="兩種都聽聽看，再在你的鍵盤上自己彈這九個音。下面每一根橫條是一個音，你按了多久它就有多長：綠點表示兩個音連上了，紅色是斷開，橘色是重疊，數字是毫秒。">
          <Articulation
            touches={['legato', 'nonLegato']}
            labels={TOUCHES}
            staffLabel="從 C 上行到 G 再回來的九個音，帶兩條圓滑線或不帶"
          />
        </Plate>
        <Aside title="先不踩踏板">
          <p>
            踩著延音踏板，不管手指怎麼彈，聲音都會延續下去。練連奏時不要踩它：要讓手指自己把音連起來。
          </p>
        </Aside>
      </Section>

      <Section id="staccato" title="斷開：斷奏和持音">
        <p>
          音符上方或下方的一個點，是<strong>斷奏</strong>
          （staccato，也叫跳音）：彈得短，大約一半時值或更短，讓琴鍵彈回來。剩下的時間是空白，但這個點不是休止符：下一個音還是要準時出現。
        </p>
        <p>
          一條短橫線是<strong>持音</strong>
          （tenuto）：把這個音彈滿整個時值，有時稍微帶一點重量。它和斷奏正好相反。
        </p>
        <Plate caption="斷奏的橫條之間空隙很大，持音幾乎沒有空隙。自己彈彈看，比較一下。">
          <Articulation
            touches={['staccato', 'tenuto']}
            labels={TOUCHES}
            staffLabel="從 C 上行到 G 再回來的九個音，上方帶點或短橫線"
          />
        </Plate>
        <Aside title="是彈起，不是抽走">
          <p>斷奏用手腕或指尖輕快地一彈，手始終靠近琴鍵，不需要把手甩開。</p>
        </Aside>
      </Section>

      <Section id="crescendo" title="試一試：漸強">
        <p>
          彈五個音，哪個鍵都可以，一個比一個大聲一點。這需要一台能感應觸鍵輕重的鍵盤；差多少都算，只要每個音都比前一個大聲，或者最後一個明顯最大聲。
        </p>
        <Plate>
          <CrescendoExercise
            prompt="彈五個音，一個比一個大聲。"
            skipTo="test-yourself"
            needsTouch="這個練習需要能感應觸鍵的 MIDI 鍵盤：電腦鍵盤、點按或觸控永遠是同一個力度。可以跳過它，做完下面的題目，這一課就完成了。"
            verdicts={{
              rising: '漸強：每個音都比前一個大聲。',
              overall: '整體是漸強，但不是每一步都更大聲：試著讓每個音都比前一個大聲一點。',
              even: '五個音一樣大聲。每個鍵都比前一個按得快一點。',
              not: '還不算漸強：有的音比前一個輕了。從很弱開始，一點一點加上去。',
            }}
          />
        </Plate>
      </Section>

      <Section id="test-yourself" title="考考自己">
        <Plate>
          <ChoiceQuiz prompt="讀一讀這些記號。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          用 MIDI
          鍵盤彈「音階」時，會測量你每個音的力度是否均勻；「樂曲」的節奏模式會替每個音計時。彈的時候仔細聽自己：力度和奏法，要靠你自己加上去。
        </p>
      </Section>
    </>
  );
}
