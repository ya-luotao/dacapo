import { Link } from 'wouter';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  ClefExplorer,
  GrandStaffLink,
  LinesAndSpaces,
  StaffQuiz,
  StepsUp,
  type Card,
} from '../staffFigures.tsx';

const CARDS: readonly Card[] = [
  { pitch: 'E4', clef: 'treble' },
  { pitch: 'A3', clef: 'bass' },
  { pitch: 'G4', clef: 'treble' },
  { pitch: 'F3', clef: 'bass' },
  { pitch: 'C4', clef: 'treble' },
  { pitch: 'B3', clef: 'bass' },
  { pitch: 'D4', clef: 'treble' },
  { pitch: 'C4', clef: 'bass' },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        乐谱上的每个音符都告诉你两件事：它有多高，持续多长。这一课讲「多高」。键盘从左到右、由低到高；五线谱则从下到上、由低到高。
      </p>

      <Section id="lines-and-spaces" title="五条线，四个间">
        <p>
          <strong>五线谱</strong>
          由五条线和它们之间的四个间组成。线和间都从下往上数：最下面一条是第一线，它上面的空隙是第一间。
        </p>
        <p>
          音符要么写<strong>在线上</strong>，线从音符中间穿过；要么写<strong>在间里</strong>
          ，夹在两条线之间。
        </p>
        <Plate caption="把指针移到谱上（或者点一下），找出每一条线、每一个间。">
          <LinesAndSpaces
            staffLabel="五条线、四个间的五线谱"
            labels={{ lines: '线', spaces: '间' }}
          />
        </Plate>
      </Section>

      <Section id="steps" title="谱上往上走，键盘往右走">
        <p>
          从一条线到它上面紧挨着的间，或者从一个间到它上面紧挨着的线，就是沿字母表往上走一步，也就是往右移一个白键。线、间、线、间：C、D、E、F，依次往上。
        </p>
        <Plate caption="从 C4 到 C5，一次走一步。点「听一听」，或者点任意一条线、一个间来听。">
          <StepsUp label="在高音谱表上从 C4 一步步走到 C5 的八个音符" />
        </Plate>
      </Section>

      <Section id="treble-clef" title="高音谱号标出 G">
        <p>
          光有五条线，并不知道每条线是什么音。写在开头的<strong>谱号</strong>
          会告诉你。<strong>高音谱号</strong>由字母 G 演变而来：它的圈绕着第二线，表示这条线上的音是
          G，也就是中央 C 上方的那个 G：
          <strong>G4</strong>。
        </p>
        <p>
          一条线有了名字，其他线和间沿着字母表上下推就知道了。高音谱表的线从下往上是{' '}
          <strong>E G B D F</strong>，间从下往上是 <strong>F A C E</strong>。
        </p>
        <Plate caption="先看 G 线，再按字母看所有的线或所有的间。把指针移到谱上任何位置，都能看到并听到那里的音。">
          <ClefExplorer
            clef="treble"
            staffLabel="高音谱表"
            labels={{ clef: 'G 线', lines: '线', spaces: '间' }}
          />
        </Plate>
        <Aside title="记忆法">
          <p>
            线从下往上：E、G、B、D、F，隔一个字母取一个；间从下往上连起来是 F-A-C-E，正好是英文单词
            face（脸）。
          </p>
        </Aside>
      </Section>

      <Section id="bass-clef" title="低音谱号标出 F">
        <p>
          较低的音用<strong>低音谱号</strong>来写，它由字母 F
          演变而来。它的两个点夹住第四线，表示这条线是 F，也就是中央 C 下方的那个 F：
          <strong>F3</strong>。
        </p>
        <p>
          低音谱表的线从下往上是 <strong>G B D F A</strong>，间是 <strong>A C E G</strong>。
        </p>
        <Plate caption="低音谱号也一样：它的 F 线、所有的线和所有的间。">
          <ClefExplorer
            clef="bass"
            staffLabel="低音谱表"
            labels={{ clef: 'F 线', lines: '线', spaces: '间' }}
          />
        </Plate>
        <Aside title="注意">
          <p>
            同一条线在两种谱号里是不同的音：最下面一条线，在高音谱号里是 E，在低音谱号里是
            G。读谱永远先看谱号。
          </p>
        </Aside>
      </Section>

      <Section id="grand-staff" title="大谱表：在中央 C 处相接">
        <p>
          钢琴谱同时用两行谱表，左边用花括号连在一起，叫作<strong>大谱表</strong>
          。上面的高音谱表主要给右手，下面的低音谱表主要给左手。
        </p>
        <Picture
          src="learn/hands-either-side.webp"
          alt="两只手放在钢琴键盘上，左手在中线左侧，右手在中线右侧，两个大拇指靠得很近。"
          caption="右手在中央 C 以上，左手在中央 C 以下：大谱表的两行谱，对应的就是两只手。"
        />
        <p>
          中央 C 正好在两行谱表中间。它需要一条属于自己的短线，叫<strong>加线</strong>
          ，而且两行谱上都能写：写在高音谱表下方，或者写在低音谱表上方，都是同一个键。
        </p>
        <p>
          谱表上下放不下的音，都可以用加线往外延伸，数法和谱表本身的线一样。高音谱表下方第一条加线上是
          C4，紧挨在它下面的间里是 B3。
        </p>
        <Plate
          wide
          caption="按住琴键，看看它们写在哪里：中央 C 及以上写在高音谱表，比它低的写在低音谱表。"
        >
          <GrandStaffLink labels={{ play: '弹奏', middle: '中央 C', staff: '大谱表' }} />
        </Plate>
      </Section>

      <Section id="try-it" title="试一试：先读，再弹">
        <p>
          两种谱号各有几个音，都在中央 C
          附近，一共八个。先看谱号，说出音名，再在正确的八度上弹出来。
        </p>
        <Plate>
          <StaffQuiz cards={CARDS} ask="弹出谱上的这个音。" onComplete={complete} />
        </Plate>
        <p>
          像这样一个音一个音地读，每天快一点，正是 dacapo 的<Link href="/read">识谱</Link>
          练习要训练的。它的前几个级别用的就是这次小测里的音，而且会记住哪些音让你慢下来。
        </p>
      </Section>
    </>
  );
}
