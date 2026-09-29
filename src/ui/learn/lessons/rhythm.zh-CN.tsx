import { ChoiceQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  BeatPulse,
  RhythmRows,
  RhythmTap,
  TimeSignatures,
  ValueCard,
  type Beat,
} from '../rhythmFigures.tsx';

const w: Beat = { duration: 'whole' };
const h: Beat = { duration: 'half' };
const q: Beat = { duration: 'quarter' };
const e: Beat = { duration: 'eighth' };
const hd: Beat = { duration: 'half', dotted: true };
const qr: Beat = { duration: 'quarter', rest: true };
const hr: Beat = { duration: 'half', rest: true };

const VALUES: readonly [Beat, string, number][] = [
  [w, '全音符', 4],
  [q, '四分音符', 1],
  [h, '二分音符', 2],
  [e, '八分音符', 0],
  [hd, '附点二分音符', 3],
  [hr, '二分休止符', 2],
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        音高说的是音在哪里，节奏说的是什么时候。几乎所有音乐底下都有一个稳定的拍子，像脉搏一样；节奏就是每个音持续多久，用这些拍子来数。
      </p>

      <Section id="beat" title="拍子">
        <p>
          听歌时跟着用脚打拍，你打的就是它的<strong>拍子</strong>
          。不管上面的音走得快还是慢，拍子始终稳定。<strong>速度</strong>
          是拍子走得多快，用每分钟多少拍（BPM）表示：60 就是一秒一拍。
        </p>
        <Plate caption="开始拍子，跟着它随便按一个键。每一下早了落在中线左边，晚了落在右边：尽量落在中间。">
          <BeatPulse labels={{ tempo: '速度' }} />
        </Plate>
      </Section>

      <Section id="note-values" title="一个音持续多久">
        <p>音符的样子告诉你它持续几拍：</p>
        <ul>
          <li>
            <strong>全音符</strong>：空心，没有符干。四拍。
          </li>
          <li>
            <strong>二分音符</strong>：空心，有符干。两拍。
          </li>
          <li>
            <strong>四分音符</strong>：实心，有符干。一拍。
          </li>
          <li>
            <strong>八分音符</strong>
            ：实心，带一个符尾，或者用符杠和旁边的音连在一起。半拍：两个八分音符合起来是一拍。
          </li>
        </ul>
        <Plate
          wide
          caption="每一行正好是四拍的一小节。点「听一听」：先有一小节的预备拍，然后钢琴弹出这些音，节拍声一直在下面打着拍子。"
        >
          <RhythmRows
            rows={[
              { title: '全音符：4 拍', rhythm: [w] },
              { title: '二分音符：每个 2 拍', rhythm: [h, h] },
              { title: '四分音符：每个 1 拍', rhythm: [q, q, q, q] },
              { title: '八分音符：每个半拍', rhythm: [e, e, e, e, e, e, e, e] },
            ]}
          />
        </Plate>
        <Aside title="数出声来">
          <p>
            边弹边数。四分音符数「1、2、3、4」。八分音符在拍与拍之间加一个「嗒」：「1 嗒 2 嗒 3 嗒 4
            嗒」，写作 1 &amp; 2 &amp;。这里每个节奏下面都印着拍数。
          </p>
        </Aside>
      </Section>

      <Section id="rests-and-dots" title="休止符与附点">
        <p>
          <strong>休止符</strong>
          是一段安静，时值和音符一一对应：全休止符挂在一条线下面，二分休止符坐在线上，四分休止符像一道闪电，八分休止符像一个小钩。遇到休止符要继续数拍，只是不弹。
        </p>
        <p>
          音符后面的<strong>附点</strong>让它再延长一半：附点二分音符是 2 + 1 = 3 拍。
        </p>
        <Plate wide caption="休止符和音符一样要数。附点二分音符占这一小节的三拍。">
          <RhythmRows
            rows={[
              { title: '四分音符、四分休止符、二分音符', rhythm: [q, qr, h] },
              { title: '二分休止符、两个四分音符', rhythm: [hr, q, q] },
              { title: '附点二分音符、四分音符', rhythm: [hd, q] },
            ]}
          />
        </Plate>
      </Section>

      <Section id="time-signature" title="小节与拍号">
        <p>
          音乐用小节线分成一个个<strong>小节</strong>，开头的<strong>拍号</strong>
          说明怎么分：上面的数字是每小节几拍，下面的数字表示以什么音符为一拍（4 表示四分音符）。4/4
          拍每小节四拍，3/4 拍三拍，像圆舞曲；2/4 拍两拍，像进行曲。
        </p>
        <p>每小节的第一拍最强。仔细听它。</p>
        <Plate caption="同样的四分音符，按四个、三个、两个一组。音调高的那一下是第 1 拍。">
          <TimeSignatures />
        </Plate>
      </Section>

      <Section id="try-it" title="试一试">
        <p>先说出每个音符和休止符持续几拍，再跟着拍子把节奏打出来。</p>
        <Plate>
          <ChoiceQuiz
            prompt="它持续几拍？"
            questions={VALUES.map(([beat, label, answer], i) => ({
              id: `${i}`,
              figure: <ValueCard beat={beat} label={label} />,
              options: ['½', '1', '2', '3', '4'],
              answer,
            }))}
          />
        </Plate>
        <Plate wide>
          <RhythmTap
            prompt="边数拍子，边在每个音符上随便按一个键。"
            rhythms={[
              [q, q, q, q],
              [h, q, q],
              [q, q, h],
              [q, e, e, h],
              [hd, q],
              [q, qr, q, q],
            ]}
            onComplete={complete}
          />
        </Plate>
        <p>
          先有四下预备拍，之后节拍声会在这一小节下面继续打着。「曲目」里的节奏模式会用同样的方法给真实乐曲的每个音计时，练习时也随时可以打开「节拍器」。
        </p>
      </Section>
    </>
  );
}
