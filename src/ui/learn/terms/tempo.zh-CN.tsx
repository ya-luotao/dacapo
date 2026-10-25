import type { TempoName } from '../../../core/tempoNames.ts';
import { Articulation, DynamicLevels, Hairpins } from '../expressionFigures.tsx';
import { Plate } from '../kit.tsx';
import { FermataPhrase, TempoChange, TempoScale, type TempoChangeKind } from '../tempoFigures.tsx';
import type { TermTexts } from './index.ts';

const TOUCHES = {
  legato: { name: '连奏', text: '下一个键按下时，才松开上一个键；第一条圆滑线结束处换一口气。' },
  nonLegato: { name: '非连奏', text: '每个音弹满大半个时值，音和音之间稍稍分开。' },
  staccato: { name: '跳音', text: '短：只弹一半时值或更短，其余是空白。' },
  tenuto: { name: '保持音', text: '弹满整个时值，稍带一点分量。' },
};

function Scale({ mark, caption }: { mark: TempoName; caption: string }) {
  return (
    <Plate caption={caption}>
      <TempoScale mark={mark} label="各个速度术语，以及它们在节拍器上每分钟的拍数" />
    </Plate>
  );
}

function Change({ kind, caption }: { kind: TempoChangeKind; caption: string }) {
  return (
    <Plate caption={caption}>
      <TempoChange kind={kind} label="排在一条线上的拍子，间距和时间成正比" />
    </Plate>
  );
}

const MARK_CAPTION = '它在速度术语中的位置。点任意一个术语，听它的速度弹八拍。';

const TEXTS: TermTexts = {
  tempo: () => (
    <>
      <p>
        意大利语的速度术语不光说快慢，也说情绪：allegro
        的本义是“欢快”，然后才是“快”。节拍器标记把速度定死，术语给出性格。
      </p>
      <p>很多曲子只写了术语。这时速度由你判断，上限是你能把最快的那些音弹干净。</p>
      <Scale mark="andante" caption={MARK_CAPTION} />
    </>
  ),

  'metronome-mark': () => (
    <>
      <p>
        标记里的音符就是按哪种音符数拍。6/8 拍里 ♩. = 60 数的是附点四分音符；慢的 2/2 拍里，二分音符
        = 60 数的就是二分音符。
      </p>
      <p>
        M.M. 是“梅尔策尔节拍器”的缩写，他在 1815
        年为节拍器申请了专利。贝多芬是最早在乐谱上写节拍器标记的作曲家之一。
      </p>
      <Scale mark="allegro" caption="♩ = 120 正是快板开始的地方。点任意一个术语，听它的速度。" />
    </>
  ),

  grave: () => (
    <>
      <p>
        意大利语“沉重、严肃”。它是最慢的速度术语，常常写在快乐章前面那段缓慢、厚重的引子上，比如贝多芬《悲怆奏鸣曲》的开头。
      </p>
      <Scale mark="grave" caption={MARK_CAPTION} />
    </>
  ),

  largo: () => (
    <>
      <p>
        意大利语“宽广”。要的是慢而饱满、舒展的声音，而不是拖沓。德沃夏克《自新大陆交响曲》的慢乐章就是广板。
      </p>
      <Scale mark="largo" caption={MARK_CAPTION} />
    </>
  ),

  larghetto: () => (
    <>
      <p>
        largo
        的指小形式，“稍宽广”。仍然是慢的，但更轻一些，往前走得多一点。莫扎特《单簧管五重奏》的慢乐章就是小广板。
      </p>
      <Scale mark="larghetto" caption={MARK_CAPTION} />
    </>
  ),

  adagio: () => (
    <>
      <p>
        来自 ad agio，“从容地”。写着 Adagio
        的慢乐章太多了，这个词本身也成了慢乐章的代称。贝多芬《月光奏鸣曲》第一乐章是 Adagio
        sostenuto。
      </p>
      <Scale mark="adagio" caption={MARK_CAPTION} />
    </>
  ),

  andante: () => (
    <>
      <p>来自 andare，“走”：走路的速度，是往前走，不是慢。海顿《惊愕交响曲》的第二乐章就是行板。</p>
      <p>andantino 通常比 andante 稍快一点，不过作曲家们对此并不总是一致。</p>
      <Scale mark="andante" caption={MARK_CAPTION} />
    </>
  ),

  moderato: () => (
    <>
      <p>
        不快不慢。它常常修饰别的词：allegro moderato 是适中的快板，andante moderato 是稳当的行板。
      </p>
      <Scale mark="moderato" caption={MARK_CAPTION} />
    </>
  ),

  allegro: () => (
    <>
      <p>
        意大利语“欢快、活泼”，在音乐里渐渐成了“快”的意思。奏鸣曲的第一乐章和末乐章大多是快板。allegretto
        是“稍快板”，更轻巧，也没那么快。
      </p>
      <Scale mark="allegro" caption={MARK_CAPTION} />
    </>
  ),

  presto: () => (
    <>
      <p>意大利语“迅速、敏捷”。比快板更快：贝多芬《月光奏鸣曲》末乐章是 Presto agitato。</p>
      <Scale mark="presto" caption={MARK_CAPTION} />
    </>
  ),

  prestissimo: () => (
    <>
      <p>presto 的最高级：在还能把音弹干净的前提下尽量快。很少见，通常只用在结尾的一小段。</p>
      <Scale mark="prestissimo" caption={MARK_CAPTION} />
    </>
  ),

  ritardando: () => (
    <>
      <p>
        ritardando 和 rallentando
        都是一点一点放慢，大多数演奏者把它们当成一回事。ritenuto（riten.）不同：是立刻慢下来，不是逐渐的。
      </p>
      <Change kind="rit" caption="先是四拍平稳的拍子，然后渐慢：每个间隔都比上一个长一点。" />
    </>
  ),

  accelerando: () => (
    <>
      <p>
        要一拍一拍均匀地加快，不能一下子跳快。stringendo（“收紧”）也是加快，通常伴随着越来越紧张。
      </p>
      <Change kind="accel" caption="先是四拍平稳的拍子，然后渐快：每个间隔都比上一个短一点。" />
    </>
  ),

  'a-tempo': () => (
    <>
      <p>
        它取消前面的 rit.、accel. 或 rubato，拍子回到之前的速度。Tempo primo（Tempo
        I）是在另一个速度的段落之后，回到全曲开头的速度。
      </p>
      <Change kind="atempo" caption="平稳，渐慢，然后 a tempo：立刻回到原来的速度。" />
    </>
  ),

  rubato: () => (
    <>
      <p>
        意大利语“被偷走的”。一个音拉长一点，时间就从周围的音那里借来，乐句先放宽，再赶回来。左手常常比上面的旋律守拍更稳。
      </p>
      <p>它首先属于浪漫派音乐，尤其是肖邦的。用得太多，拍子就没了。</p>
    </>
  ),

  fermata: () => (
    <>
      <p>
        停多久由演奏者决定，常见的是写的时值的两倍左右。写在休止符上，就是停住的一段安静；写在全曲最后一个和弦上，让声音自己消失。
      </p>
      <Plate caption="一个停在 G 上的乐句，分别听有延长记号和没有的样子。">
        <FermataPhrase
          label="C、B、A，然后是带延长记号的 G，再到 C"
          labels={{ held: '有延长记号', plain: '没有' }}
        />
      </Plate>
    </>
  ),

  'dynamic-marks': () => (
    <>
      <p>
        这些字母来自意大利语：p 是 piano，弱；f 是 forte，强；m 是
        mezzo，“中”。从弱到强：pp、p、mp、mf、f、ff。
      </p>
      <p>它们是相对的。摇篮曲里的 f 和进行曲里的 f 不一样，每架琴、每个房间听起来也不一样。</p>
      <Plate caption="选一个力度，听同一个乐句用它来弹。">
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
    </>
  ),

  crescendo: () => (
    <>
      <p>
        意大利语“增长”。它从前面的力度出发，到后面的力度为止；后面没写力度时，强到什么程度由你决定。开始时要弱得留有余地。
      </p>
      <Plate caption="同一个起伏，分别用楔形记号和文字写出来。">
        <Hairpins
          staffLabel="九个音符上行到 G 再回来，下方有渐强和渐弱记号"
          labels={{ hairpins: '楔形记号', words: '文字' }}
        />
      </Plate>
    </>
  ),

  diminuendo: () => (
    <>
      <p>
        意大利语“减少”；decrescendo 意思一样。跨好几个小节的长渐弱，常用来结束一个乐句或整首曲子。
      </p>
      <Plate caption="同一个起伏，分别用楔形记号和文字写出来。">
        <Hairpins
          staffLabel="九个音符上行到 G 再回来，下方有渐强和渐弱记号"
          labels={{ hairpins: '楔形记号', words: '文字' }}
        />
      </Plate>
    </>
  ),

  legato: () => (
    <>
      <p>
        意大利语“连起来的”。一个键抬起的同时下一个键按下，音和音之间声音不断。圆滑线结束的地方，换一小口气。
      </p>
      <Plate caption="同一条旋律，连奏和非连奏。自己弹一遍，时间线会显示你是怎么把音连起来的。">
        <Articulation
          touches={['legato', 'nonLegato']}
          labels={TOUCHES}
          staffLabel="从 C 上行到 G 再回来的九个音，带两条圆滑线或不带"
        />
      </Plate>
    </>
  ),

  staccato: () => (
    <>
      <p>
        意大利语“分开的”。点缩短的是音，不是拍：下一个音照样准时进来，中间是一段空白。楔形的短跳音（staccatissimo）更短。
      </p>
      <Plate caption="同一条旋律，跳音和保持音。自己弹一遍，时间线会显示每个音你按了多久。">
        <Articulation
          touches={['staccato', 'tenuto']}
          labels={TOUCHES}
          staffLabel="从 C 上行到 G 再回来的九个音，上方带点或短横线"
        />
      </Plate>
    </>
  ),

  dolce: () => (
    <p>
      意大利语“甜的”。它说的是音色，也是音量：轻柔，触键温和，没有生硬的棱角。常常和 p
      一起写在一段旋律的开头。
    </p>
  ),

  cantabile: () => (
    <p>
      意大利语“可以唱的”。让旋律在伴奏之上唱起来：音要连，句子要像歌手换气那样有起伏，伴奏的那只手要轻一些。肖邦让学生多去听优秀的歌唱家，来学这个。
    </p>
  ),

  espressivo: () => (
    <p>
      它要的是乐句本来就有的东西再多一些：强弱起伏更大，音乐倾向的地方多给一点时间。常常只标在一个乐句、一段独奏旋律，或者主题再次出现的时候。
    </p>
  ),

  modifiers: () => (
    <>
      <p>它们放在所修饰的词前面或后面，也可以叠起来用：poco più mosso，稍快一点。</p>
      <Plate>
        <table className="term-table">
          <thead>
            <tr>
              <th scope="col">词</th>
              <th scope="col">意思</th>
              <th scope="col">例子</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">molto</th>
              <td>很、非常</td>
              <td>molto rit.：大幅渐慢</td>
            </tr>
            <tr>
              <th scope="row">poco</th>
              <td>稍微</td>
              <td>poco cresc.：稍渐强</td>
            </tr>
            <tr>
              <th scope="row">poco a poco</th>
              <td>一点一点地</td>
              <td>poco a poco accel.：逐渐加快</td>
            </tr>
            <tr>
              <th scope="row">più</th>
              <td>更</td>
              <td>più mosso：更有动力，更快</td>
            </tr>
            <tr>
              <th scope="row">meno</th>
              <td>较少</td>
              <td>meno mosso：动力少些，更慢</td>
            </tr>
            <tr>
              <th scope="row">sempre</th>
              <td>始终、一直</td>
              <td>sempre legato：一直连奏</td>
            </tr>
            <tr>
              <th scope="row">subito</th>
              <td>突然</td>
              <td>subito p：突然变弱</td>
            </tr>
            <tr>
              <th scope="row">non troppo</th>
              <td>不过分</td>
              <td>allegro ma non troppo：快，但不要太快</td>
            </tr>
          </tbody>
        </table>
      </Plate>
    </>
  ),
};

export default TEXTS;
