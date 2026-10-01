import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { Excerpt, FormTimeline, PeriodTimeline } from '../styleFigures.tsx';
import type { FormName, Period } from '../styles.ts';

const PERIOD_NAMES: Record<Period, string> = {
  baroque: '巴洛克',
  classical: '古典樂派',
  romantic: '浪漫樂派',
  modern: '印象樂派及其後',
};
const COMPOSER_NAMES = {
  petzold: '佩佐爾德',
  bach: '巴哈',
  beethoven: '貝多芬',
  burgmuller: '布爾格彌勒',
  chopin: '蕭邦',
  schumann: '舒曼',
  tchaikovsky: '柴可夫斯基',
  satie: '薩提',
};

const PERIOD_OPTIONS = [
  PERIOD_NAMES.baroque,
  PERIOD_NAMES.classical,
  PERIOD_NAMES.romantic,
  PERIOD_NAMES.modern,
];

const FORM_NAMES: Record<FormName, string> = {
  period: '快樂頌',
  binary: 'G 大調小步舞曲',
  songForm: '古老的法國歌曲',
  rondoSection: '給愛麗絲',
};

const FORM_OPTIONS = ['二段式', '三段式', '輪旋曲式', '變奏曲'];

const HEARD = '聽聽看：這段音樂像是哪個時期的？';
const QUESTIONS: readonly ChoiceQuestion[] = [
  ...(
    [
      ['bach-musette-in-d', '1', '8', 100, 0],
      ['chopin-prelude-in-c-minor', '1', '4', 42, 2],
      ['beethoven-ode-to-joy', '1', '8', 108, 1],
      ['satie-gymnopedie-1', '5', '13', 72, 3],
      ['petzold-minuet-in-g-minor', '1', '8', 120, 0],
      ['tchaikovsky-morning-prayer', '1', '8', 62, 2],
    ] as const
  ).map(([piece, from, to, bpm, answer]) => ({
    id: piece,
    question: HEARD,
    figure: <Excerpt key={piece} piece={piece} from={from} to={to} bpm={bpm} />,
    options: PERIOD_OPTIONS,
    answer,
  })),
  {
    id: 'ternary',
    question: '一段旋律，一段不同的中段，再回到那段旋律。這是什麼曲式？',
    figure: null,
    options: FORM_OPTIONS,
    answer: 1,
  },
  {
    id: 'binary',
    question: '前後兩半，各彈兩遍；後一半從離家遠的地方開始，最後回到家。',
    figure: null,
    options: FORM_OPTIONS,
    answer: 0,
  },
  {
    id: 'rondo',
    question: 'A B A C A：第一段旋律在幾段新旋律之間一次又一次回來。',
    figure: null,
    options: FORM_OPTIONS,
    answer: 2,
  },
  {
    id: 'variations',
    question: '一段旋律，然後同一段旋律一遍又一遍，每次都有變化。',
    figure: null,
    options: FORM_OPTIONS,
    answer: 3,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        巴哈同時代的人寫的小步舞曲，和蕭邦寫的前奏曲，相隔一百年，寫給不同的樂器，彈法也不一樣。知道一首曲子是什麼時候寫的，就知道了不少該怎麼彈的事；知道它是怎麼搭起來的，學起來、記起來都更容易。這一課用「樂曲」裡的曲子當例子。
      </p>

      <Section id="periods" title="音樂的時期">
        <p>
          音樂史通常分成幾個時期，每個時期有自己的聲音。年代只是大概：風格變得很慢，作曲家們也不會同時一起變。學鋼琴最先遇到的是下面這四個。
        </p>
        <Plate
          wide
          caption="各個時期，以及「樂曲」裡幾位作曲家的生卒年。選一個時期，看看屬於它的作曲家。"
        >
          <PeriodTimeline
            labels={PERIOD_NAMES}
            composers={COMPOSER_NAMES}
            label="1600 年到 1950 年的各個時期"
          />
        </Plate>
      </Section>

      <Section id="baroque" title="巴洛克，約 1600–1750 年">
        <p>
          巴哈和韓德爾的音樂，常常是寫給大鍵琴和古鋼琴（clavichord）的，不一定是鋼琴。它的織度常常是
          <strong>複音</strong>
          ：兩條或更多的旋律線同時進行，每一條都是一段獨立的旋律，而不是旋律加和弦。G
          大調小步舞曲的左手有自己的旋律線，不只是伴奏。大鍵琴沒辦法從弱慢慢變強，所以力度是一層一層變的，這一句弱、下一句強，叫
          <strong>階梯式力度</strong>。
        </p>
        <ul>
          <li>觸鍵均勻，速度穩定，每條旋律線都清楚。</li>
          <li>快的音常常稍微斷開，兩個音一組的圓滑線則連起來。</li>
          <li>很少用或不用踏板：連奏靠手指。</li>
          <li>裝飾音落在拍子上，顫音從上方的音開始。</li>
          <li>強弱整塊地變，一次一整句。</li>
        </ul>
        <Plate caption="G 大調小步舞曲的前八小節：兩條旋律線，各走各的。">
          <Excerpt
            piece="petzold-minuet-in-g"
            from="1"
            to="8"
            bpm={120}
            source="佩佐爾德〈G 大調小步舞曲〉，第 1–8 小節"
          />
        </Plate>
        <p>
          「樂曲」裡有：巴哈的〈C 大調前奏曲〉和〈D 大調風笛舞曲〉，佩佐爾德的 G 大調和 G
          小調小步舞曲。
        </p>
      </Section>

      <Section id="classical" title="古典樂派，約 1750–1820 年">
        <p>
          海頓、莫札特和年輕時的貝多芬的音樂。鋼琴取代了大鍵琴，靠觸鍵就能彈出強弱，以及強弱之間的每一層。音樂是旋律加伴奏，樂句清楚、勻稱，常常成對出現，一問一答。一種常見的伴奏叫
          <strong>阿爾貝蒂低音</strong>，把和弦照低、高、中、高的順序分解：C G E G。
        </p>
        <ul>
          <li>旋律在上面，伴奏在下面，輕而均勻。</li>
          <li>樂句清楚，每一句都有起伏，結尾換一口氣。</li>
          <li>奏法乾淨，圓滑線和斷奏都照譜上寫的彈。</li>
          <li>踏板用得節制，用來連接、上色，絕不能彈得一片模糊。</li>
        </ul>
        <Plate caption="〈給愛麗絲〉的開頭：左手是分解和弦，上面是旋律，兩個樂句一問一答。">
          <Excerpt
            piece="beethoven-fur-elise"
            from="0"
            to="8"
            bpm={66}
            source="貝多芬〈給愛麗絲〉，第 1–8 小節"
          />
        </Plate>
        <p>
          「樂曲」裡有：貝多芬的〈給愛麗絲〉和〈快樂頌〉。〈快樂頌〉是貝多芬晚年為《第九號交響曲》寫的，那是
          1824 年，他的音樂已經在邁向下一個時期。
        </p>
      </Section>

      <Section id="romantic" title="浪漫樂派，約 1820–1900 年">
        <p>
          舒伯特、舒曼、蕭邦、李斯特、布拉姆斯和柴可夫斯基的音樂，寫給更大、聲音更飽滿的鋼琴。它講的是感情：
          <strong>歌唱性的旋律</strong>
          ，帶來色彩和驚喜的和聲，從耳語到全力的巨大對比。很多曲子篇幅不長，帶一個標題，寫一種心情或一個場景。
        </p>
        <ul>
          <li>旋律要唱出來，蓋過其他聲部，像人在唱歌。</li>
          <li>
            <strong>彈性速度</strong>
            （rubato，意思是「偷來的時間」）：在樂句的高點稍微放慢，之後再趕回來。左手要比右手更穩。
          </li>
          <li>延音踏板幾乎一直在用，隨和聲更換。</li>
          <li>力度範圍大，從 pp 到 ff，還有長長的漸強。</li>
        </ul>
        <Plate caption="柴可夫斯基〈古老的法國歌曲〉的開頭：一段憂傷的旋律，下面是一個持續的 G。">
          <Excerpt
            piece="tchaikovsky-old-french-song"
            from="0"
            to="8"
            bpm={70}
            source="柴可夫斯基〈古老的法國歌曲〉，第 1–8 小節"
          />
        </Plate>
        <p>
          「樂曲」裡有：舒曼的〈士兵進行曲〉，布爾格彌勒的〈阿拉貝斯克〉和〈純潔〉，柴可夫斯基的〈古老的法國歌曲〉和〈晨禱〉，以及蕭邦的〈C
          小調前奏曲〉。
        </p>
      </Section>

      <Section id="impressionism" title="印象樂派及其後，約 1890 年起">
        <p>
          德布西、拉威爾和薩提的音樂。它像同時代的畫家一樣，描繪心情和色彩。和弦是因為它本身的聲音而選的，不一定要走向哪裡：〈裸體歌舞〉在兩個大七和弦
          G 和 D 之間輕輕搖擺，哪一個都不需要解決。薩提在 1888
          年寫了這首曲子，比德布西最有名的鋼琴曲早幾年；後來德布西還把它改編成了管弦樂。
        </p>
        <ul>
          <li>輕、勻、不急；聲音比速度更重要。</li>
          <li>踏板是用來上色的：把和聲融成一片朦朧，換踏板要小心。</li>
          <li>力度輕柔，每個和弦都要斟酌好，讓幾個音一起響。</li>
        </ul>
        <Plate caption="〈裸體歌舞第 1 號〉的前十三小節：先是搖擺的和弦，然後旋律進來。">
          <Excerpt
            piece="satie-gymnopedie-1"
            from="1"
            to="13"
            bpm={72}
            source="薩提〈裸體歌舞第 1 號〉，第 1–13 小節"
          />
        </Plate>
      </Section>

      <Section id="phrases" title="樂句與樂段">
        <p>
          音樂是由<strong>樂句</strong>
          組成的，就像文章由句子組成，一個樂句常常是四小節。兩個成對的樂句，一問一答，組成一個
          <strong>樂段</strong>。問句的結尾是開放的，常常停在 V
          級上，也就是半終止；答句開頭和問句一樣，最後回到家，落在 I 級上。
        </p>
        <p>
          知道了樂句，彈起來、學起來都更容易：每一句都彈出起伏，句與句之間換氣，一句一句地學。下面講的各種曲式都是由樂句搭起來的，就像故事是由句子寫成的。
        </p>
      </Section>

      <Section id="forms" title="曲式">
        <p>
          一首曲子的<strong>曲式</strong>
          ，就是它的各個段落怎麼一個接一個：哪些會再出現，哪些是新的。段落用字母來稱呼：第一段叫
          A，下一段新的叫 B，A 稍有變化就寫成 A′。下面是最常遇到的幾種曲式。
        </p>
        <ul>
          <li>
            <strong>二段式</strong>
            ，A
            B，每一半通常都反覆。前一半離開家，或者在家裡停一停；後一半走得更遠，再回到家。巴洛克的舞曲大多是二段式，比如兩首小步舞曲：G
            小調那首的前一半結束在降 B 大調上。
          </li>
          <li>
            <strong>三段式</strong>
            ，A B
            A：一段旋律，一段對比的中段，再回到那段旋律。柴可夫斯基的〈古老的法國歌曲〉是一首小小的三段式，a
            a b a；〈D 大調風笛舞曲〉照當時的習慣，最後把前一半再彈一遍，也就成了三段式。
          </li>
          <li>
            <strong>輪旋曲式</strong>
            ，A B A C
            A：主旋律在一段段新的插入段之間一次又一次回來。〈給愛麗絲〉就是輪旋曲：那段著名的旋律在兩個對比的插入段之間回來；「樂曲」裡收錄的是它的第一部分，本身是一個小小的
            a b a。
          </li>
          <li>
            <strong>變奏曲</strong>
            （主題與變奏）：一段旋律，然後同一段旋律一遍又一遍，每次在節奏、和聲或情緒上有所變化。〈快樂頌〉就是貝多芬《第九號交響曲》終樂章裡一組變奏的主題。
          </li>
        </ul>
        <Plate
          wide
          caption="「樂曲」裡的四首曲子，照實際彈的順序排開，反覆也算在內，每一段的長度和它的小節數成比例。選一首，點一段聽聽看。"
        >
          <FormTimeline
            forms={['period', 'binary', 'songForm', 'rondoSection']}
            labels={FORM_NAMES}
            readouts={{
              period:
                '一個樂段，再多一點：第一句是問，結束在 D 上；第二句是答，結束在 C 上。然後是一個新樂句，再答一遍。',
              binary: '二段式：前後兩半各十六小節，各反覆一次。後一半走到 D 大調，再回到家。',
              songForm: '三段式，a a b a：旋律彈兩遍，一個新的中段，再彈一遍旋律。',
              rondoSection: '輪旋曲的 A 段：旋律，一個短短的中段，再回到旋律；前後兩半都反覆。',
            }}
          />
        </Plate>
        <p>
          有些名字說的是曲子的用途，而不是它的結構。<strong>前奏曲</strong>
          原本是在別的曲子之前彈的：巴哈的前奏曲後面接著一首賦格，蕭邦的前奏曲則各自獨立，常常只圍繞一個樂思。
          <strong>練習曲</strong>
          專練一種技巧，比如布爾格彌勒那些均勻的快速音群。<strong>性格小品</strong>
          是帶標題、寫一種心情的短曲，比如舒曼的〈士兵進行曲〉。
        </p>
        <Aside title="兩句話說完奏鳴曲式">
          <p>
            很多奏鳴曲和交響曲的第一樂章，先呈示兩個主題，第二個在另一個調上，再在發展部裡把它們帶到別的調。然後兩個主題都回來，這一次都在主調上。
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="試一試">
        <p>聽幾段音樂，說出它們的時期；再認幾種曲式。</p>
        <Plate>
          <ChoiceQuiz prompt="風格與曲式。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          <Link href="/pieces">「樂曲」</Link>
          裡的每一首曲子都寫明了它的時期和曲式。學一首新曲子之前，先找出它的段落，標出每一段從哪裡開始。
        </p>
      </Section>
    </>
  );
}
