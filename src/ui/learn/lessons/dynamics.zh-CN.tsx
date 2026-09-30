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
  legato: { name: '连奏', text: '下一个键按下时，才松开上一个键；第一条圆滑线结束处换一口气。' },
  nonLegato: { name: '非连奏', text: '每个音弹满大半个时值，音和音之间稍稍分开。' },
  staccato: { name: '跳音', text: '短：只弹一半时值或更短，其余是空白。' },
  tenuto: { name: '保持音', text: '弹满整个时值，稍带一点分量。' },
};

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'mp-mf',
    question: '哪个更强？',
    figure: null,
    options: ['mp', 'mf'],
    answer: 1,
  },
  {
    id: 'p-pp',
    question: '哪个更弱？',
    figure: null,
    options: ['p', 'pp', 'mp'],
    answer: 1,
  },
  {
    id: 'staccato',
    question: '音符上的这个点是什么意思？',
    figure: <MarkCard mark="staccato" label="上方有一个点的音符" />,
    options: ['弹得短而断开', '稍微多保持一会儿', '弹得更响'],
    answer: 0,
  },
  {
    id: 'dim',
    question: '音符下面的这个记号是什么意思？',
    figure: <MarkCard hairpin="dim" label="四个音符，下面是一个收口的楔形记号" />,
    options: ['逐渐变强', '逐渐变弱', '第一个音弹得更响'],
    answer: 1,
  },
  {
    id: 'accent',
    question: '那一个音符上的这个记号呢？',
    figure: <MarkCard mark="accent" label="上方有重音记号的音符" />,
    options: ['这个音比周围的音更响', '逐渐变弱', '弹满整个时值'],
    answer: 0,
  },
  {
    id: 'tenuto',
    question: '音符上的这条短线是什么意思？',
    figure: <MarkCard mark="tenuto" label="上方有一条短横线的音符" />,
    options: ['弹满整个时值', '弹得短', '弹得轻'],
    answer: 0,
  },
  {
    id: 'relative',
    question: 'f 到底有多响？',
    figure: null,
    options: ['永远是同样的响度', '在这首曲子、这台琴上算响'],
    answer: 1,
  },
  {
    id: 'balance',
    question: '右手弹旋律，左手弹和弦：哪个应该更响？',
    figure: null,
    options: ['旋律', '和弦', '一样响'],
    answer: 0,
  },
  {
    id: 'slur-end',
    question: '一条圆滑线结束的地方该怎么弹？',
    figure: null,
    options: ['手稍稍抬起，乐句换一口气', '最后一个音保持得更久', '最后一个音弹得更响'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        同样的音，可以弹得响，也可以弹得轻；可以连成一片，也可以一个个分开。乐谱会把这两样都标出来，而「弹出音符」和「弹出音乐」之间的差别，很大一部分就在这里。这一课教你读这些记号，并且亲耳听一听；如果你有
        MIDI 键盘，还能看到自己是怎么弹的。
      </p>

      <Section id="loud-and-soft" title="强与弱">
        <p>
          表示强弱的词来自意大利语。<strong>piano</strong> 是「弱」，<strong>forte</strong>{' '}
          是「强」：钢琴的全名
          pianoforte，意思就是「能弱也能强」。谱上用它们的首字母表示，写在谱表下方，是粗体斜体的字母。这些叫
          <strong>力度记号</strong>。
        </p>
        <ul>
          <li>
            <strong>pp</strong>，pianissimo：很弱
          </li>
          <li>
            <strong>p</strong>，piano：弱
          </li>
          <li>
            <strong>mp</strong>，mezzo-piano：中弱
          </li>
          <li>
            <strong>mf</strong>，mezzo-forte：中强
          </li>
          <li>
            <strong>f</strong>，forte：强
          </li>
          <li>
            <strong>ff</strong>，fortissimo：很强
          </li>
        </ul>
        <p>
          一个力度记号一直管到下一个出现为止。它们是相对的，不是精确的音量：摇篮曲里的 f
          比进行曲里的 f 温和得多，你的琴、你的房间也会让它们不一样。要紧的是一级和一级之间的差别。
        </p>
        <Plate caption="选一个力度记号，点「听一听」：同一个乐句，时弱时强。第二个按钮把第一小节从 pp 到 ff 依次弹一遍。">
          <DynamicLevels
            staffLabel="高音谱表上《欢乐颂》的开头，下方有一个力度记号"
            labels={{
              all: '从 pp 到 ff',
              levels: {
                pp: { name: 'pianissimo', meaning: '很弱' },
                p: { name: 'piano', meaning: '弱' },
                mp: { name: 'mezzo-piano', meaning: '中弱' },
                mf: { name: 'mezzo-forte', meaning: '中强' },
                f: { name: 'forte', meaning: '强' },
                ff: { name: 'fortissimo', meaning: '很强' },
              },
            }}
          />
        </Plate>
        <p>
          在钢琴上，响不响取决于琴键按下去有多快：按得越快，琴槌打得越重（原因见
          <Link href="/learn/inside">「钢琴里面是什么样的」</Link>）。MIDI 键盘会测出这个速度，用 1
          到 127 的数字发出来，叫作<strong>力度值</strong>
          （velocity）。
        </p>
        <Plate caption="弹几个音，有的轻、有的重：每一根柱子就是你按下一个键的力度。">
          <VelocityMeter label="你刚弹的那个音" />
        </Plate>
        <Aside title="弱比强难">
          <p>弹得又轻又均匀，比弹得响难得多。指尖贴着琴键，慢一点按下去，但一定要按到底。</p>
        </Aside>
      </Section>

      <Section id="louder-and-softer" title="渐强与渐弱">
        <p>
          <strong>渐强</strong>（crescendo，写作 <em>cresc.</em>）是逐渐变强；
          <strong>渐弱</strong>（diminuendo，写作 <em>dim.</em>，也写作 decrescendo、
          <em>decresc.</em>
          ）是逐渐变弱。文字后面跟一条虚线，一直画到变化结束的地方。同样的意思也常画成一个细长的楔形：开口越来越大是渐强，越来越小是渐弱。
        </p>
        <Plate caption="同一个起伏的两种写法：一路强到 G，再弱回来。听一听声音怎样涨起来、落下去。">
          <Hairpins
            staffLabel="九个音符上行到 G 再回来，下方有渐强和渐弱记号"
            labels={{ hairpins: '楔形记号', words: '文字' }}
          />
        </Plate>
        <Aside title="给渐强留出余地">
          <p>
            渐强要从足够弱的地方开始，才有地方可去。两个音就已经很响了，到后面就没有可以再强的了。
          </p>
        </Aside>
      </Section>

      <Section id="accents" title="重音">
        <p>
          <strong>重音记号</strong>是写在音符上方或下方的一个小「&gt;」，要这一个音比周围的音更响。
          <strong>sf</strong> 或 <strong>sfz</strong>
          （sforzando，<strong>突强</strong>
          ）是突然的、强烈的重音，常常出现在一段弱的音乐当中。弹完它，马上回到原来的力度。
        </p>
        <p>别把重音记号和渐弱记号搞混：重音记号很小，只管一个音；渐弱记号横跨好几个音。</p>
        <Plate caption="重音让轻声的旋律里有两个音跳出来；sf 则是一个突然、有力的音。">
          <Accents
            staffLabel="C 大三和弦的九个音，上行再下行，标着弱，带有重音记号或 sf"
            labels={{ accents: '重音', sf: 'sf' }}
          />
        </Plate>
      </Section>

      <Section id="balance" title="旋律盖过和弦">
        <p>
          两只手一起弹的时候，它们很少是平等的。一个声部唱旋律，其余的为它伴奏，所以旋律要浮在上面：它的音比同时按下的和弦稍微响一点，哪怕两者标的是同一个力度。这叫作
          <strong>声部平衡</strong>。旋律通常是右手最上面的那个音，左手要弹得轻一些。
        </p>
        <Plate caption="《欢乐颂》配上和弦，三种弹法。只有第一种是对的：旋律清楚，和弦在它下面。">
          <Balance
            staffLabel="大谱表上的《欢乐颂》，高音谱表是旋律，低音谱表是和弦"
            labels={{ balanced: '旋律在上', even: '一样响', under: '和弦在上' }}
            readouts={{
              balanced: '旋律比和弦响：它在和弦上面唱出来。',
              even: '所有音一样响：旋律淹没在和弦里。',
              under: '和弦比旋律响：旋律很难听清楚。',
            }}
          />
        </Plate>
        <Aside title="先分手练">
          <p>先单独弹旋律，再单独弹和弦，只用一半的力度。然后合起来，保持住这个差别。</p>
        </Aside>
      </Section>

      <Section id="legato" title="连起来：连奏">
        <p>
          <strong>连奏</strong>
          （legato，意大利语「连起来」）是每个音和下一个音连在一起，中间没有空隙。在钢琴上，这要靠手指：下一个键按下去的同时，松开上一个键，像走路一样，一只脚落地，另一只脚才离开地面。
        </p>
        <p>
          <strong>圆滑线</strong>
          （也叫连线）是画在几个不同音高的音符上方或下方的弧线，要求这几个音连奏。它还把音符组成一个
          <strong>乐句</strong>
          ，就像几个字组成一句话。一条圆滑线结束的地方，手稍稍抬起：最后一个音略短一点，音乐换一口气，再开始下一句。
        </p>
        <p>
          既没有圆滑线、也没有记号的音，要弹满大半个时值。连得多紧要看音乐：弹巴赫时常常稍稍分开，叫作
          <strong>非连奏</strong>（non legato）；更晚的音乐里，通常几乎是连着的。
        </p>
        <Plate caption="两种都听一听，再在你的键盘上自己弹这九个音。下面每一根横条是一个音，你按了多久它就有多长：绿点表示两个音连上了，红色是断开，橙色是重叠，数字是毫秒。">
          <Articulation
            touches={['legato', 'nonLegato']}
            labels={TOUCHES}
            staffLabel="从 C 上行到 G 再回来的九个音，带两条圆滑线或不带"
          />
        </Plate>
        <Aside title="先不踩踏板">
          <p>
            踩着延音踏板，不管手指怎么弹，声音都会延续下去。练连奏时不要踩它：要让手指自己把音连起来。
          </p>
        </Aside>
      </Section>

      <Section id="staccato" title="断开：跳音和保持音">
        <p>
          音符上方或下方的一个点，是<strong>跳音</strong>
          （staccato，也叫断奏）：弹得短，大约一半时值或更短，让琴键弹回来。剩下的时间是空白，但这个点不是休止符：下一个音还是要准时出现。
        </p>
        <p>
          一条短横线是<strong>保持音</strong>
          （tenuto）：把这个音弹满整个时值，有时稍带一点分量。它和跳音正好相反。
        </p>
        <Plate caption="跳音的横条之间空隙很大，保持音几乎没有空隙。自己弹一弹，比较一下。">
          <Articulation
            touches={['staccato', 'tenuto']}
            labels={TOUCHES}
            staffLabel="从 C 上行到 G 再回来的九个音，上方带点或短横线"
          />
        </Plate>
        <Aside title="是弹起，不是抽走">
          <p>跳音用手腕或指尖轻快地一弹，手始终靠近琴键，不需要把手甩开。</p>
        </Aside>
      </Section>

      <Section id="crescendo" title="试一试：渐强">
        <p>
          弹五个音，哪个键都行，一个比一个响一点。这需要一台能感应触键轻重的键盘；差多少都算，只要每个音都比前一个响，或者最后一个明显最响。
        </p>
        <Plate>
          <CrescendoExercise
            prompt="弹五个音，一个比一个响。"
            skipTo="test-yourself"
            needsTouch="这个练习需要能感应触键的 MIDI 键盘：电脑键盘、点击或轻触永远是同一个力度。可以跳过它，做完下面的题目，这一课就完成了。"
            verdicts={{
              rising: '渐强：每个音都比前一个响。',
              overall: '整体是渐强，但不是每一步都更响：试着让每个音都比前一个响一点。',
              even: '五个音一样响。每个键都比前一个按得快一点。',
              not: '还不算渐强：有的音比前一个轻了。从很弱开始，一点点加上去。',
            }}
          />
        </Plate>
      </Section>

      <Section id="test-yourself" title="考考自己">
        <Plate>
          <ChoiceQuiz prompt="读一读这些记号。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          用 MIDI
          键盘弹「音阶」时，会测量你每个音的力度是否均匀；「曲目」的节奏模式会给每个音计时。弹的时候听着自己：力度和奏法，要靠你自己加上去。
        </p>
      </Section>
    </>
  );
}
