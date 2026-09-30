import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { Excerpt, FormTimeline, PeriodTimeline } from '../styleFigures.tsx';
import type { FormName, Period } from '../styles.ts';

const PERIOD_NAMES: Record<Period, string> = {
  baroque: '巴洛克',
  classical: '古典主义',
  romantic: '浪漫主义',
  modern: '印象主义及以后',
};
const COMPOSER_NAMES = {
  petzold: '佩措尔德',
  bach: '巴赫',
  beethoven: '贝多芬',
  burgmuller: '布格缪勒',
  chopin: '肖邦',
  schumann: '舒曼',
  tchaikovsky: '柴可夫斯基',
  satie: '萨蒂',
};

const PERIOD_OPTIONS = [
  PERIOD_NAMES.baroque,
  PERIOD_NAMES.classical,
  PERIOD_NAMES.romantic,
  PERIOD_NAMES.modern,
];

const FORM_NAMES: Record<FormName, string> = {
  period: '欢乐颂',
  binary: 'G 大调小步舞曲',
  songForm: '古老的法国歌曲',
  rondoSection: '致爱丽丝',
};

const FORM_OPTIONS = ['二部曲式', '三部曲式', '回旋曲式', '变奏曲'];

const HEARD = '听一听：这段音乐像是哪个时期的？';
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
    question: '一个旋律，一段不同的中段，再回到那个旋律。这是什么曲式？',
    figure: null,
    options: FORM_OPTIONS,
    answer: 1,
  },
  {
    id: 'binary',
    question: '前后两半，各弹两遍；后一半从离家远的地方开始，最后回到家。',
    figure: null,
    options: FORM_OPTIONS,
    answer: 0,
  },
  {
    id: 'rondo',
    question: 'A B A C A：第一个旋律在几段新旋律之间一次又一次回来。',
    figure: null,
    options: FORM_OPTIONS,
    answer: 2,
  },
  {
    id: 'variations',
    question: '一个旋律，然后同一个旋律一遍又一遍，每次都有变化。',
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
        巴赫同时代人写的小步舞曲，和肖邦写的前奏曲，相隔一百年，写给不同的乐器，弹法也不一样。知道一首曲子是什么时候写的，就知道了不少该怎么弹；知道它是怎么搭起来的，学起来、记起来都更容易。这一课用「曲目」里的曲子做例子。
      </p>

      <Section id="periods" title="音乐的时期">
        <p>
          音乐史通常分成几个时期，每个时期有自己的声音。年代只是大概：风格变得很慢，作曲家们也不会同时一起变。学钢琴最先遇到的是下面这四个。
        </p>
        <Plate
          wide
          caption="各个时期，以及「曲目」里几位作曲家的生卒年。选一个时期，看看属于它的作曲家。"
        >
          <PeriodTimeline
            labels={PERIOD_NAMES}
            composers={COMPOSER_NAMES}
            label="1600 年到 1950 年的各个时期"
          />
        </Plate>
      </Section>

      <Section id="baroque" title="巴洛克，约 1600–1750 年">
        <p>
          巴赫和亨德尔的音乐，常常是写给羽管键琴和古钢琴的，不一定是钢琴。它的织体常常是
          <strong>复调</strong>
          ：两条或更多的旋律线同时进行，每一条都是一段独立的旋律，而不是旋律加和弦。G
          大调小步舞曲的左手有自己的旋律线，不只是伴奏。羽管键琴没法从弱慢慢变强，所以力度是一层一层变的，这一句弱、下一句强，叫
          <strong>阶梯式力度</strong>。
        </p>
        <ul>
          <li>触键均匀，速度稳定，每条旋律线都清楚。</li>
          <li>快的音常常稍微断开，两个音一组的圆滑线连起来。</li>
          <li>很少用或不用踏板：连奏靠手指。</li>
          <li>装饰音落在拍子上，颤音从上方的音开始。</li>
          <li>强弱整块地变，一次一整句。</li>
        </ul>
        <Plate caption="G 大调小步舞曲的前八小节：两条旋律线，各走各的。">
          <Excerpt
            piece="petzold-minuet-in-g"
            from="1"
            to="8"
            bpm={120}
            source="佩措尔德《G 大调小步舞曲》，第 1–8 小节"
          />
        </Plate>
        <p>
          「曲目」里有：巴赫的《C 大调前奏曲》和《D 大调风笛舞曲》，佩措尔德的 G 大调和 G
          小调小步舞曲。
        </p>
      </Section>

      <Section id="classical" title="古典主义，约 1750–1820 年">
        <p>
          海顿、莫扎特和青年贝多芬的音乐。钢琴取代了羽管键琴，靠触键就能弹出强弱，以及强弱之间的每一层。音乐是旋律加伴奏，乐句清楚、匀称，常常成对出现，一问一答。一种常见的伴奏叫
          <strong>阿尔贝蒂低音</strong>，把和弦按低、高、中、高的顺序分解：C G E G。
        </p>
        <ul>
          <li>旋律在上面，伴奏在下面，轻而均匀。</li>
          <li>乐句清楚，每一句都有起伏，结尾换一口气。</li>
          <li>奏法干净，圆滑线和跳音都照谱上写的弹。</li>
          <li>踏板用得节制，用来连接、上色，决不能弹得一片模糊。</li>
        </ul>
        <Plate caption="《致爱丽丝》的开头：左手是分解和弦，上面是旋律，两个乐句一问一答。">
          <Excerpt
            piece="beethoven-fur-elise"
            from="0"
            to="8"
            bpm={66}
            source="贝多芬《致爱丽丝》，第 1–8 小节"
          />
        </Plate>
        <p>
          「曲目」里有：贝多芬的《致爱丽丝》和《欢乐颂》。《欢乐颂》是贝多芬晚年为《第九交响曲》写的，那是
          1824 年，他的音乐已经在迈向下一个时期。
        </p>
      </Section>

      <Section id="romantic" title="浪漫主义，约 1820–1900 年">
        <p>
          舒伯特、舒曼、肖邦、李斯特、勃拉姆斯和柴可夫斯基的音乐，写给更大、声音更丰满的钢琴。它讲的是感情：
          <strong>歌唱性的旋律</strong>
          ，给人色彩和意外的和声，从耳语到全力的巨大对比。很多曲子篇幅不长，带一个标题，写一种心情或一个场景。
        </p>
        <ul>
          <li>旋律要唱出来，盖过其他声部，像人在唱歌。</li>
          <li>
            <strong>弹性速度</strong>
            （rubato，意思是「偷来的时间」）：在乐句的高点稍微放慢，之后再赶回来。左手要比右手更稳。
          </li>
          <li>延音踏板几乎一直在用，随和声更换。</li>
          <li>力度范围大，从 pp 到 ff，还有长长的渐强。</li>
        </ul>
        <Plate caption="柴可夫斯基《古老的法国歌曲》的开头：一支忧伤的旋律，下面是一个保持着的 G。">
          <Excerpt
            piece="tchaikovsky-old-french-song"
            from="0"
            to="8"
            bpm={70}
            source="柴可夫斯基《古老的法国歌曲》，第 1–8 小节"
          />
        </Plate>
        <p>
          「曲目」里有：舒曼的《士兵进行曲》，布格缪勒的《阿拉伯风格曲》和《纯洁》，柴可夫斯基的《古老的法国歌曲》和《晨祷》，以及肖邦的《C
          小调前奏曲》。
        </p>
      </Section>

      <Section id="impressionism" title="印象主义及以后，约 1890 年起">
        <p>
          德彪西、拉威尔和萨蒂的音乐。它像同时代的画家一样，描绘心情和色彩。和弦是因为它本身的声音而选的，不一定要走向哪里：《裸体歌舞》在两个大七和弦
          G 和 D 之间轻轻摇摆，哪一个都不需要解决。萨蒂在 1888
          年写了这首曲子，比德彪西最有名的钢琴曲早几年；后来德彪西还把它改编成了管弦乐。
        </p>
        <ul>
          <li>轻、匀、不急；声音比速度更重要。</li>
          <li>踏板是用来上色的：把和声融成一片朦胧，换踏板要小心。</li>
          <li>力度安静，每个和弦都要掂量好，让几个音一起响。</li>
        </ul>
        <Plate caption="《裸体歌舞》第 1 号的前十三小节：先是摇摆的和弦，然后旋律进来。">
          <Excerpt
            piece="satie-gymnopedie-1"
            from="1"
            to="13"
            bpm={72}
            source="萨蒂《裸体歌舞》第 1 号，第 1–13 小节"
          />
        </Plate>
      </Section>

      <Section id="phrases" title="乐句与乐段">
        <p>
          音乐是由<strong>乐句</strong>
          组成的，就像文章由句子组成，一个乐句常常是四小节。两个成对的乐句，一问一答，组成一个
          <strong>乐段</strong>。问句的结尾是开放的，常常停在 V
          级上，也就是半终止；答句开头和问句一样，最后回到家，落在 I 级上。
        </p>
        <p>
          知道了乐句，弹起来、学起来都更容易：每一句都弹出起伏，句与句之间换气，一句一句地学。下面讲的各种曲式都是由乐句搭起来的，就像故事是由句子写成的。
        </p>
      </Section>

      <Section id="forms" title="曲式">
        <p>
          一首曲子的<strong>曲式</strong>
          ，就是它的各个段落怎样一个接一个：哪些会再出现，哪些是新的。段落用字母来称呼：第一段叫
          A，下一段新的叫 B，A 稍有变化就写成 A′。下面是最常遇到的几种曲式。
        </p>
        <ul>
          <li>
            <strong>二部曲式</strong>
            ，A
            B，每一半通常都反复。前一半离开家，或者在家里停一停；后一半走得更远，再回到家。巴洛克的舞曲大多是二部曲式，比如两首小步舞曲：G
            小调那首的前一半结束在降 B 大调上。
          </li>
          <li>
            <strong>三部曲式</strong>
            ，A B
            A：一个旋律，一段对比的中段，再回到那个旋律。柴可夫斯基的《古老的法国歌曲》是一首小小的三部曲式，a
            a b a；《D 大调风笛舞曲》按当时的习惯，最后把前一半再弹一遍，也就成了三部曲式。
          </li>
          <li>
            <strong>回旋曲式</strong>
            ，A B A C
            A：主旋律在一段段新的插部之间一次又一次回来。《致爱丽丝》就是回旋曲：那段著名的旋律在两个对比的插部之间回来；「曲目」里收的是它的第一部分，本身是一个小小的
            a b a。
          </li>
          <li>
            <strong>变奏曲</strong>
            （主题与变奏）：一个旋律，然后同一个旋律一遍又一遍，每次在节奏、和声或情绪上有所变化。《欢乐颂》就是贝多芬《第九交响曲》末乐章里一组变奏的主题。
          </li>
        </ul>
        <Plate
          wide
          caption="「曲目」里的四首曲子，按实际弹的顺序排开，反复也算在内，每一段的长度和它的小节数成比例。选一首，点一段听一听。"
        >
          <FormTimeline
            forms={['period', 'binary', 'songForm', 'rondoSection']}
            labels={FORM_NAMES}
            readouts={{
              period:
                '一个乐段，再多一点：第一句是问，结束在 D 上；第二句是答，结束在 C 上。然后是一个新乐句，再答一遍。',
              binary: '二部曲式：前后两半各十六小节，各反复一次。后一半走到 D 大调，再回到家。',
              songForm: '三部曲式，a a b a：旋律弹两遍，一个新的中段，再弹一遍旋律。',
              rondoSection: '回旋曲的 A 部分：旋律，一个短短的中段，再回到旋律；前后两半都反复。',
            }}
          />
        </Plate>
        <p>
          有些名字说的是曲子的用途，而不是它的结构。<strong>前奏曲</strong>
          原本是在别的曲子之前弹的：巴赫的前奏曲后面跟着一首赋格，肖邦的前奏曲则各自独立，常常只围绕一个乐思。
          <strong>练习曲</strong>
          专练一种技术，比如布格缪勒那些均匀的跑动。<strong>性格小品</strong>
          是带标题、写一种心情的短曲，比如舒曼的《士兵进行曲》。
        </p>
        <Aside title="两句话说奏鸣曲式">
          <p>
            很多奏鸣曲和交响曲的第一乐章，先呈示两个主题，第二个在另一个调上，再在展开部里把它们带到别的调。然后两个主题都回来，这一次都在主调上。
          </p>
        </Aside>
      </Section>

      <Section id="try-it" title="试一试">
        <p>听几段音乐，说出它们的时期；再认几种曲式。</p>
        <Plate>
          <ChoiceQuiz prompt="风格与曲式。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          <Link href="/pieces">「曲目」</Link>
          里的每一首曲子都写明了它的时期和曲式。学一首新曲子之前，先找出它的段落，标出每一段从哪里开始。
        </p>
      </Section>
    </>
  );
}
