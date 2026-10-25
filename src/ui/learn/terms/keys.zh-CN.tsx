import {
  CircleOfFifths,
  DegreeScale,
  Modulation,
  SharpsAndFlats,
  Transposed,
  type CircleLabels,
} from '../keyFigures.tsx';
import { Plate } from '../kit.tsx';
import { KeySignatures, MajorAndMinor, RelativeMinor, ScaleBuilder } from '../theoryFigures.tsx';
import type { TermTexts } from './index.ts';

const CIRCLE: CircleLabels = {
  major: '{tonic} 大调',
  minor: '{tonic} 小调',
  signature: (fifths) =>
    fifths === 0 ? '没有升降号' : `${Math.abs(fifths)} 个${fifths > 0 ? '升号' : '降号'}`,
  circle: '五度圈',
  staff: '高音谱表上的调号',
};

const TEXTS: TermTexts = {
  key: () => (
    <>
      <p>
        大多数曲子最后都会回到同一个音上。这个音叫<strong>主音</strong>
        ，以它开头、带着相应升降号的音阶，就是这首曲子的调。G 大调的曲子用 G 大调音阶里的音，有
        F♯，停在 G 上才听着像结束了。
      </p>
      <p>调要听一整句才听得出来，单靠一个和弦听不出：它是一组音，加上其中一个当作家。</p>
      <Plate caption="选一个调：看它的音阶，可以写升降号，也可以用调号。">
        <ScaleBuilder
          staffLabel="高音谱表上的大调音阶"
          labels={{
            tonic: '调',
            accidentals: '写升降号',
            signature: '用调号',
            steps: '音阶的每一步',
            whole: '全',
            half: '半',
          }}
        />
      </Plate>
    </>
  ),

  'key-signature': () => (
    <>
      <p>
        有升号时，最后一个升号往上一个半音就是调名：F♯ C♯ 是 D
        大调。有降号时，倒数第二个降号就是调名：B♭ E♭ A♭ 是降 E 大调。一个降号是 F 大调，记住就好。
      </p>
      <p>
        每个调号同时也属于一个小调，在大调主音往下三个半音的地方：两个升号是 D 大调，也可能是 B
        小调。是哪一个，要听音乐本身，尤其是最后一个和弦。
      </p>
      <Plate caption="选一个调，看它在两行谱上的调号，升降号按顺序写出名字。">
        <KeySignatures staffLabel="大谱表上的调号" none="没有升降号" />
      </Plate>
    </>
  ),

  'order-of-sharps-and-flats': () => (
    <>
      <p>
        每多一个升号，都比前一个高五度（F、C、G……）；每多一个降号，都比前一个低五度（B、E、A……）。所以调号从不跳着写：三个升号一定是
        F♯、C♯ 和 G♯。
      </p>
      <p>只要记住升号的顺序 F C G D A E B，倒过来念就是降号。</p>
      <Plate caption="先是七个升号，再是七个降号，每个记号下面写着它的名字。">
        <SharpsAndFlats
          labels={{ sharps: '高音谱表上的七个升号', flats: '高音谱表上的七个降号' }}
        />
      </Plate>
    </>
  ),

  'circle-of-fifths': () => (
    <>
      <p>
        从最上面的 C 顺时针读：G 一个升号，D 两个，A 三个。反过来读：F 一个降号，降 B 两个，降 E
        三个。两边在最下面碰头，F♯ 大调和降 G 大调是同一组键，只是名字不同。
      </p>
      <p>
        每个大调里面一圈是它的关系小调，调号相同。圈上相邻的两个调只差一个音，所以音乐在邻居之间转来转去最顺。
      </p>
      <Plate caption="选一个调，外圈是大调，内圈是小调：谱上会出现它的调号，并弹出它的音阶。">
        <CircleOfFifths labels={CIRCLE} />
      </Plate>
    </>
  ),

  'relative-keys': () => (
    <>
      <p>
        关系小调从大调音阶的第 6 个音开始：C 大调是 A，G 大调是
        E。从大调主音往下三个半音就能找到它；从小调主音往上三个半音，就是它的关系大调。
      </p>
      <p>
        小调的曲子通常会把第 7 级升高（A 小调里的
        G♯），写成临时记号。看到这个升号，最容易分出是小调还是它的关系大调。
      </p>
      <Plate caption="选一个大调，再切换到它的关系小调：同样的音、同样的调号，只是换了起点。">
        <RelativeMinor
          staffLabel="带调号的大调音阶或它的关系小调"
          labels={{
            key: '大调',
            majorName: '{tonic} 大调',
            minorName: '{tonic} 小调',
            readout: {
              major: '{minor} 小调从 {major} 大调的第 6 个音开始。',
              minor: '和 {major} 大调同样的音、同样的调号，从 {minor} 到 {minor}。',
            },
          }}
        />
      </Plate>
    </>
  ),

  'parallel-keys': () => (
    <>
      <p>
        主音一样，音不一样。C 小调把 C 大调里的三个音降低了：E、A、B 变成
        E♭、A♭、B♭。最听得出来的是三度：C–E 是大，C–E♭ 是小。
      </p>
      <p>
        作曲家常在两者之间来回：C 小调的曲子最后停在 C
        大三和弦上，或者把一段旋律换成小调再唱一遍，颜色就暗下来。
      </p>
      <Plate caption="C 大调和 C 小调的《两只老虎》：只变了一个音，E 变成 E♭。">
        <MajorAndMinor
          staffLabel="高音谱表上的《两只老虎》"
          labels={{ major: 'C 大调', minor: 'C 小调' }}
        />
      </Plate>
    </>
  ),

  'scale-degrees': () => (
    <>
      <p>
        和声主要靠其中三个。<strong>主音</strong>（1）是家。<strong>属音</strong>
        （5）总想回到主音，建在它上面的和弦，几乎是每首曲子最后一个和弦之前的那一个。
        <strong>下属音</strong>
        （4）上的和弦，就是赞美诗结尾“阿门”的那个和弦。
      </p>
      <p>
        <strong>导音</strong>
        （7）在主音下面一个半音，要往上走到主音。在小调里，通常要把它升高，才有这个半音。
      </p>
      <Plate caption="C 大调音阶：每个音下面是它的级数，名字列在下面。">
        <DegreeScale
          label="高音谱表上的 C 大调音阶"
          names={['主音', '上主音', '中音', '下属音', '属音', '下中音', '导音']}
        />
      </Plate>
    </>
  ),

  transposition: () => (
    <>
      <p>
        每个音都移动同样的音程，音与音之间的距离不变，所以还是同一首曲子。从 C 移到 G，就要用 G
        大调的调号，一个升号。
      </p>
      <p>
        歌手常把歌移到适合自己嗓音的调。在 dacapo 里，曲目页面上可以把整首曲子按半音移高或移低。
      </p>
      <Plate caption="《小星星》第一句的三个调：音变了，旋律没变。">
        <Transposed keyName="{tonic} 大调" label="高音谱表上的《小星星》" />
      </Plate>
    </>
  ),

  modulation: () => (
    <>
      <p>
        一个新的音反复出现，就听得出转调了：C 大调的曲子里 F 一再变成 F♯，接着一个终止式落在 G
        上。大调最常转到它的属调，小调最常转到它的关系大调。
      </p>
      <p>
        最顺的办法是借一个两个调都有的和弦。A 小三和弦在 C 大调里是 vi，在 G 大调里是 ii；它后面的
        D7 只属于 G 大调，于是 G 听起来成了新的家。
      </p>
      <Plate caption="从 C 大调转到 G 大调。A 小三和弦两个调都有，D7 只属于 G 大调。">
        <Modulation
          label="大谱表上的五个和弦，从 C 大调到 G 大调"
          numerals={['C: I', 'IV', 'vi = ii', 'G: V7', 'I']}
        />
      </Plate>
    </>
  ),

  'closely-related-keys': () => (
    <>
      <p>
        C 大调的近关系调是 G 大调和 F 大调，也就是五度圈上的两个邻居，再加上这三个大调的关系小调：A
        小调、E 小调和 D 小调。它们和 C 大调最多只差一个升号或降号。
      </p>
      <p>A 小调也是这五个：E 小调、D 小调、C 大调、G 大调和 F 大调。</p>
      <Plate caption="选一个调：它的近关系调会被标出来。">
        <CircleOfFifths labels={CIRCLE} near />
      </Plate>
    </>
  ),
};

export default TEXTS;
