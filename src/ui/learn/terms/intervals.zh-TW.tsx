import {
  EnharmonicPair,
  IntervalPair,
  IntervalTable,
  type IntervalRow,
} from '../intervalFigures.tsx';
import { Plate } from '../kit.tsx';
import { StepExplorer } from '../theoryFigures.tsx';
import type { TermTexts } from './index.ts';

const ROWS: readonly IntervalRow[] = [
  { name: '小二度', short: 'm2', halfSteps: 1, upper: 'Db4' },
  { name: '大二度', short: 'M2', halfSteps: 2, upper: 'D4' },
  { name: '小三度', short: 'm3', halfSteps: 3, upper: 'Eb4' },
  { name: '大三度', short: 'M3', halfSteps: 4, upper: 'E4' },
  { name: '純四度', short: 'P4', halfSteps: 5, upper: 'F4' },
  { name: '三全音', short: 'TT', halfSteps: 6, upper: 'F#4' },
  { name: '純五度', short: 'P5', halfSteps: 7, upper: 'G4' },
  { name: '小六度', short: 'm6', halfSteps: 8, upper: 'Ab4' },
  { name: '大六度', short: 'M6', halfSteps: 9, upper: 'A4' },
  { name: '小七度', short: 'm7', halfSteps: 10, upper: 'Bb4' },
  { name: '大七度', short: 'M7', halfSteps: 11, upper: 'B4' },
  { name: '純八度', short: 'P8', halfSteps: 12, upper: 'C5' },
];

function Pair({ low, high, readout }: { low: string; high: string; readout: string }) {
  return (
    <Plate caption="聽聽看：兩個音先分開彈，再一起彈。鍵上的數字是在數半音。">
      <IntervalPair low={low} high={high} readout={readout} label={`譜上的 ${low} 和 ${high}`} />
    </Plate>
  );
}

const TEXTS: TermTexts = {
  interval: () => (
    <>
      <p>
        從低音數到高音，兩頭都算：C、D、E 是三個字母，所以 C 到 E 是<strong>三度</strong>
        。在譜上，三度是從一條線到上一條線，或從一個間到上一個間。
      </p>
      <p>
        只看度數，還不知道兩個鍵隔多遠。C 到 E 和 C 到 E♭
        都是三度，一個是四個半音，一個是三個。度數前面的「大」「小」就是用來區分它們的。
      </p>
      <Pair low="C4" high="E4" readout="三度：4 個半音" />
    </>
  ),

  'half-step': () => (
    <>
      <p>
        在譜上，半音要嘛是同一條線或同一個間加上升降記號（C 到 C♯），要嘛是往上移到緊鄰的線或間（E
        到 F）。大部分的半音都和黑鍵相連，白鍵與白鍵之間的半音只有 E–F 和 B–C 兩處。
      </p>
      <Plate caption="彈或點任何一個鍵，它左右各一個半音的鍵會標出來。">
        <StepExplorer />
      </Plate>
    </>
  ),

  'whole-step': () => (
    <>
      <p>
        全音中間要跨過一個鍵：C 到 D 跨過 C♯，E 到 F♯ 跨過 F。所以全音可以從白鍵開始，落在黑鍵上。
      </p>
      <p>大調音階就是全音中間夾兩個半音：全、全、半、全、全、全、半。</p>
      <Pair low="C4" high="D4" readout="2 個半音" />
    </>
  ),

  enharmonic: () => (
    <>
      <p>
        每個黑鍵都有兩個名字：F 和 G 之間的鍵叫 F♯，也叫 G♭。有幾個白鍵也有第二個名字：E 也是 F♭，C
        也是 B♯。
      </p>
      <p>
        寫哪個名字，要看是什麼調。D 大調寫 F♯，因為音階裡已經有 G 了；降 D 大調寫 G♭，因為已經有 F
        了。
      </p>
      <Plate caption="F♯ 和 G♭：譜上兩個音，琴上同一個鍵。">
        <EnharmonicPair a="F#4" b="Gb4" label="高音譜表上的升 F 和降 G" />
      </Plate>
    </>
  ),

  'interval-quality': () => (
    <>
      <p>
        二度、三度、六度、七度各有兩種大小：<strong>大</strong>音程，和比它小一個半音的
        <strong>小</strong>音程。一度、四度、五度、八度通常只有一種大小，叫<strong>純</strong>音程。
      </p>
      <p>
        大音程或純音程再寬一個半音，就是<strong>增</strong>音程；小音程或純音程再窄一個半音，就是
        <strong>減</strong>音程。C 到 F♯ 是增四度，C 到 G♭ 是減五度，兩個都是六個半音。
      </p>
      <Plate caption="從中央 C 開始，八度以內的每個音程。">
        <IntervalTable rows={ROWS} head={['音程', '半音數', '從 C 開始']} />
      </Plate>
    </>
  ),

  'minor-second': () => (
    <>
      <p>
        兩個音一起彈會互相摩擦，是最不協和的音程。分開彈，它是旋律能走的最小一步，例如導音上行到主音，B
        到 C。倒過來是大七度。
      </p>
      <Pair low="E4" high="F4" readout="1 個半音" />
    </>
  ),

  'major-second': () => (
    <>
      <p>
        音階裡大部分相鄰的兩個音都是大二度。在譜上是從線到緊鄰的間，或從間到緊鄰的線，琴上相隔兩個半音。倒過來是小七度。
      </p>
      <Pair low="C4" high="D4" readout="2 個半音" />
    </>
  ),

  'minor-third': () => (
    <>
      <p>
        三個半音，跨三個字母：A–C、E–G、D–F。小三和弦最下面就是一個小三度，它聽起來是小調的色彩，主要就是因為這個。倒過來是大六度。
      </p>
      <Pair low="A4" high="C5" readout="3 個半音" />
    </>
  ),

  'major-third': () => (
    <>
      <p>
        大三和弦的下半部：C 大調裡的 C–E，G 大調裡的
        G–B。上面再疊一個小三度，和弦就完整了。倒過來是小六度。
      </p>
      <Pair low="C4" high="E4" readout="4 個半音" />
    </>
  ),

  'perfect-fourth': () => (
    <>
      <p>
        跨四個字母：C–F、G–C、D–G。聽起來空曠，又像話還沒說完。很多曲子一開頭就是它，從屬音上行到主音，〈奇異恩典〉就是從
        D 跳到 G。倒過來是純五度。
      </p>
      <Pair low="D4" high="G4" readout="5 個半音" />
    </>
  ),

  tritone: () => (
    <>
      <p>名字說的就是它有幾個全音：三個，F–G–A–B。它正好把八度分成兩半，所以倒過來還是三全音。</p>
      <p>
        屬七和弦裡的緊張感就來自它。G7 裡，三全音在 B 和 F 之間，它們分別想走到 C 和 E。從 F
        往上寫到 B 是增四度；從 B 往上寫到 F 是減五度。
      </p>
      <Pair low="F4" high="B4" readout="6 個半音" />
    </>
  ),

  'perfect-fifth': () => (
    <>
      <p>
        跨五個字母，線到線或間到間：C–G、D–A、F–C。除了八度，它是最穩定的音程，每個大三和弦和小三和弦的根音和五音之間都是純五度。小提琴和大提琴的弦就是按五度調的。
      </p>
      <p>五度圈就是按這個音程一步步走過所有的調。</p>
      <Pair low="C4" high="G4" readout="7 個半音" />
    </>
  ),

  'minor-sixth': () => (
    <>
      <p>
        跨六個字母，八個半音：E 到上面的 C，A 到上面的
        F。它是大三度倒過來。一起彈是協和的，比大六度暗一點。
      </p>
      <Pair low="E4" high="C5" readout="8 個半音" />
    </>
  ),

  'major-sixth': () => (
    <>
      <p>
        C 到上面的 A，G 到上面的
        E：九個半音。它是小三度倒過來。兩個聲部一起進行時，最常用的就是三度和六度。
      </p>
      <Pair low="C4" high="A4" readout="9 個半音" />
    </>
  ),

  'minor-seventh': () => (
    <>
      <p>
        比八度少一個全音。G7（G、B、D、F）裡，它在 G 和 F 之間，讓這個和弦有一股往 C
        走的傾向。倒過來是大二度。
      </p>
      <Pair low="G4" high="F5" readout="10 個半音" />
    </>
  ),

  'major-seventh': () => (
    <>
      <p>
        比八度少一個半音：C 到 B，F 到 E。單獨一起彈，兩個音衝突得很明顯；在大七和弦 C E G B
        裡，中間的音會把它緩和下來。倒過來是小二度。
      </p>
      <Pair low="C4" high="B4" readout="11 個半音" />
    </>
  ),

  octave: () => (
    <>
      <p>
        相隔八度的兩個音聽起來太像了，所以用同一個名字。鍵盤上每個 C 都叫
        C，再用數字標出是第幾個八度：中央 C 是 C4。上面那個音的振動正好是下面的兩倍快。
      </p>
      <p>左手彈八度能讓低音更厚實。音符上方寫 8va，就不用把它們寫高一個八度了。</p>
      <Pair low="C4" high="C5" readout="12 個半音" />
    </>
  ),

  'interval-inversion': () => (
    <>
      <p>
        轉位前後兩個度數加起來總是九：二度變七度，三度變六度，四度變五度。性質也跟著翻過來：大變小，小變大，增變減，純的還是純的。
      </p>
      <p>
        C 到上面的 E 是大三度，轉位成 E 到上面的
        C，是小六度。四個半音加八個半音，正好是一個八度的十二個。
      </p>
      <Pair low="C4" high="E4" readout="大三度：4 個半音" />
      <Pair low="E4" high="C5" readout="小六度：8 個半音" />
    </>
  ),

  'compound-interval': () => (
    <>
      <p>
        減去七，就知道裡面是什麼音程：九度是一個八度加二度（9 − 7 =
        2），十度是八度加三度，十二度是八度加五度。性質跟著裡面那個小音程：C 到高八度的 D 是大九度。
      </p>
      <p>左手彈十度，大部分人的手要張得很開，所以常常分開彈。</p>
      <Pair low="C4" high="D5" readout="大九度：14 個半音" />
    </>
  ),

  'consonance-and-dissonance': () => (
    <>
      <p>
        協和的：八度、五度、四度、三度、六度。不協和的：二度、七度和三全音。四度比較特別：在兩個高聲部之間是協和的，但在較早的音樂裡，它和低音構成時被當作不協和。
      </p>
      <p>不協和音程想要往前走。它通常級進到一個協和音程上，例如 G7 裡的三全音 B–F 走到 C–E。</p>
      <Pair low="C4" high="G4" readout="純五度：協和" />
      <Pair low="B4" high="F5" readout="三全音：不協和" />
    </>
  ),
};

export default TEXTS;
