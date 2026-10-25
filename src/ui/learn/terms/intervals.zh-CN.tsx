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
  { name: '纯四度', short: 'P4', halfSteps: 5, upper: 'F4' },
  { name: '三全音', short: 'TT', halfSteps: 6, upper: 'F#4' },
  { name: '纯五度', short: 'P5', halfSteps: 7, upper: 'G4' },
  { name: '小六度', short: 'm6', halfSteps: 8, upper: 'Ab4' },
  { name: '大六度', short: 'M6', halfSteps: 9, upper: 'A4' },
  { name: '小七度', short: 'm7', halfSteps: 10, upper: 'Bb4' },
  { name: '大七度', short: 'M7', halfSteps: 11, upper: 'B4' },
  { name: '纯八度', short: 'P8', halfSteps: 12, upper: 'C5' },
];

function Pair({ low, high, readout }: { low: string; high: string; readout: string }) {
  return (
    <Plate caption="听一听：两个音先分开弹，再一起弹。键上的数字是在数半音。">
      <IntervalPair low={low} high={high} readout={readout} label={`谱上的 ${low} 和 ${high}`} />
    </Plate>
  );
}

const TEXTS: TermTexts = {
  interval: () => (
    <>
      <p>
        从低音数到高音，两头都算：C、D、E 是三个字母，所以 C 到 E 是<strong>三度</strong>
        。在谱上，三度是从一条线到上一条线，或者从一个间到上一个间。
      </p>
      <p>
        光看度数，还不知道两个键隔多远。C 到 E 和 C 到 E♭
        都是三度，一个是四个半音，一个是三个。度数前面的“大”“小”就是用来区分它们的。
      </p>
      <Pair low="C4" high="E4" readout="三度：4 个半音" />
    </>
  ),

  'half-step': () => (
    <>
      <p>
        在谱上，半音要么是同一条线或同一个间加上升降号（C 到 C♯），要么是往上挪到紧挨着的线或间（E
        到 F）。大多数半音都连着黑键，白键和白键之间的半音只有 E–F 和 B–C 两处。
      </p>
      <Plate caption="弹或点任意一个键，它左右各一个半音的键会标出来。">
        <StepExplorer />
      </Plate>
    </>
  ),

  'whole-step': () => (
    <>
      <p>
        全音中间要跨过一个键：C 到 D 跨过 C♯，E 到 F♯ 跨过 F。所以全音可以从白键开始，落在黑键上。
      </p>
      <p>大调音阶就是全音中间夹两个半音：全、全、半、全、全、全、半。</p>
      <Pair low="C4" high="D4" readout="2 个半音" />
    </>
  ),

  enharmonic: () => (
    <>
      <p>
        每个黑键都有两个名字：F 和 G 之间的键叫 F♯，也叫 G♭。有几个白键也有第二个名字：E 也是 F♭，C
        也是 B♯。
      </p>
      <p>
        写哪个名字，要看是什么调。D 大调写 F♯，因为音阶里已经有 G 了；降 D 大调写 G♭，因为已经有 F
        了。
      </p>
      <Plate caption="F♯ 和 G♭：谱上两个音，琴上同一个键。">
        <EnharmonicPair a="F#4" b="Gb4" label="高音谱表上的升 F 和降 G" />
      </Plate>
    </>
  ),

  'interval-quality': () => (
    <>
      <p>
        二度、三度、六度、七度各有两种大小：<strong>大</strong>音程，和比它小一个半音的
        <strong>小</strong>音程。一度、四度、五度、八度通常只有一种大小，叫<strong>纯</strong>音程。
      </p>
      <p>
        大音程或纯音程再宽一个半音，就是<strong>增</strong>音程；小音程或纯音程再窄一个半音，就是
        <strong>减</strong>音程。C 到 F♯ 是增四度，C 到 G♭ 是减五度，两个都是六个半音。
      </p>
      <Plate caption="从中央 C 开始，八度以内的每个音程。">
        <IntervalTable rows={ROWS} head={['音程', '半音数', '从 C 开始']} />
      </Plate>
    </>
  ),

  'minor-second': () => (
    <>
      <p>
        两个音一起弹，会互相摩擦，是最不协和的音程。分开弹，它是旋律能走的最小一步，比如导音上行到主音，B
        到 C。倒过来是大七度。
      </p>
      <Pair low="E4" high="F4" readout="1 个半音" />
    </>
  ),

  'major-second': () => (
    <>
      <p>
        音阶里大多数相邻的两个音都是大二度。在谱上是从线到紧挨着的间，或者从间到紧挨着的线，琴上相隔两个半音。倒过来是小七度。
      </p>
      <Pair low="C4" high="D4" readout="2 个半音" />
    </>
  ),

  'minor-third': () => (
    <>
      <p>
        三个半音，跨三个字母：A–C、E–G、D–F。小三和弦最下面就是一个小三度，它听起来“小”，主要就是因为这个。倒过来是大六度。
      </p>
      <Pair low="A4" high="C5" readout="3 个半音" />
    </>
  ),

  'major-third': () => (
    <>
      <p>
        大三和弦的下半部分：C 大调里的 C–E，G 大调里的
        G–B。上面再叠一个小三度，和弦就完整了。倒过来是小六度。
      </p>
      <Pair low="C4" high="E4" readout="4 个半音" />
    </>
  ),

  'perfect-fourth': () => (
    <>
      <p>
        跨四个字母：C–F、G–C、D–G。听起来空阔，又像没说完。很多曲子一开头就是它，从属音上行到主音，《奇异恩典》就是从
        D 跳到 G。倒过来是纯五度。
      </p>
      <Pair low="D4" high="G4" readout="5 个半音" />
    </>
  ),

  tritone: () => (
    <>
      <p>名字说的就是它有几个全音：三个，F–G–A–B。它正好把八度一分为二，所以倒过来还是三全音。</p>
      <p>
        属七和弦里那股紧张感就来自它。G7 里，三全音在 B 和 F 之间，它们分别想走到 C 和 E。从 F
        往上写到 B 是增四度；从 B 往上写到 F 是减五度。
      </p>
      <Pair low="F4" high="B4" readout="6 个半音" />
    </>
  ),

  'perfect-fifth': () => (
    <>
      <p>
        跨五个字母，线到线或间到间：C–G、D–A、F–C。除了八度，它是最稳的音程，每个大三和弦和小三和弦的根音和五音之间都是纯五度。小提琴和大提琴的弦就是按五度定的。
      </p>
      <p>五度圈就是按这个音程一步步走过所有的调。</p>
      <Pair low="C4" high="G4" readout="7 个半音" />
    </>
  ),

  'minor-sixth': () => (
    <>
      <p>
        跨六个字母，八个半音：E 到上面的 C，A 到上面的
        F。它是大三度倒过来。一起弹是协和的，比大六度暗一点。
      </p>
      <Pair low="E4" high="C5" readout="8 个半音" />
    </>
  ),

  'major-sixth': () => (
    <>
      <p>
        C 到上面的 A，G 到上面的
        E：九个半音。它是小三度倒过来。两个声部一起走的时候，最常用的就是三度和六度。
      </p>
      <Pair low="C4" high="A4" readout="9 个半音" />
    </>
  ),

  'minor-seventh': () => (
    <>
      <p>
        比八度少一个全音。G7（G、B、D、F）里，它在 G 和 F 之间，让这个和弦有一股往 C
        走的劲儿。倒过来是大二度。
      </p>
      <Pair low="G4" high="F5" readout="10 个半音" />
    </>
  ),

  'major-seventh': () => (
    <>
      <p>
        比八度少一个半音：C 到 B，F 到 E。单独一起弹，两个音撞得很厉害；在大七和弦 C E G B
        里，中间的音会把它缓和下来。倒过来是小二度。
      </p>
      <Pair low="C4" high="B4" readout="11 个半音" />
    </>
  ),

  octave: () => (
    <>
      <p>
        相隔八度的两个音听起来太像了，所以用同一个名字。键盘上每个 C 都叫
        C，再用数字标出是第几个八度：中央 C 是 C4。上面那个音的振动正好是下面的两倍快。
      </p>
      <p>左手弹八度能让低音更厚。音符上方写 8va，就不用把它们写高一个八度了。</p>
      <Pair low="C4" high="C5" readout="12 个半音" />
    </>
  ),

  'interval-inversion': () => (
    <>
      <p>
        转位前后两个度数加起来总是九：二度变七度，三度变六度，四度变五度。性质也跟着翻过来：大变小，小变大，增变减，纯的还是纯的。
      </p>
      <p>
        C 到上面的 E 是大三度，转位成 E 到上面的
        C，是小六度。四个半音加八个半音，正好是一个八度的十二个。
      </p>
      <Pair low="C4" high="E4" readout="大三度：4 个半音" />
      <Pair low="E4" high="C5" readout="小六度：8 个半音" />
    </>
  ),

  'compound-interval': () => (
    <>
      <p>
        减去七，就知道里面是什么音程：九度是一个八度加二度（9 − 7 =
        2），十度是八度加三度，十二度是八度加五度。性质跟着里面那个小音程走：C 到高八度的 D
        是大九度。
      </p>
      <p>左手弹十度，大多数人的手要撑得很开，所以常常分开弹。</p>
      <Pair low="C4" high="D5" readout="大九度：14 个半音" />
    </>
  ),

  'consonance-and-dissonance': () => (
    <>
      <p>
        协和的：八度、五度、四度、三度、六度。不协和的：二度、七度和三全音。四度比较特殊：在两个高声部之间是协和的，但在早期的音乐里，它和低音构成时被当作不协和。
      </p>
      <p>不协和音程想要往前走。它通常级进到一个协和音程上，比如 G7 里的三全音 B–F 走到 C–E。</p>
      <Pair low="C4" high="G4" readout="纯五度：协和" />
      <Pair low="B4" high="F5" readout="三全音：不协和" />
    </>
  ),
};

export default TEXTS;
