import { SequenceExercise } from '../exercises.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { FingerNumbers, FingeringOnStaff, FivePosition } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 71]; // C3–B4

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        怎么坐、手怎么放，决定了手指能做到什么。好习惯在一开始养成，比日后再改容易得多，也能让你一直弹得舒服。
      </p>

      <Section id="sitting" title="坐在钢琴前">
        <Picture
          src="learn/posture-from-the-side.webp"
          alt="从侧面看一位坐在琴凳上的弹琴者：小臂与琴键齐平，背挺直，双脚平放在地上。"
          caption="侧面看：小臂与琴键大致齐平，手肘略在身体前方，背挺直，双脚放平。"
        />
        <ul>
          <li>坐在琴凳的前半部分，面对中央 C。</li>
          <li>
            <strong>高度</strong>
            ：小臂与琴键大致齐平。太低，手腕会塌到琴键下面；太高，肩膀会耸起来。可以调高琴凳，或者垫一个结实的坐垫。
          </li>
          <li>
            <strong>距离</strong>
            ：双手放在琴键上时，手肘略在身体前方。如果手肘顶着身体两侧，就把琴凳往后挪。
          </li>
          <li>背挺直，从髋部微微前倾；肩膀放低、放松。</li>
          <li>双脚平放在地上，右脚靠近踏板。</li>
        </ul>
        <Picture
          src="learn/seated-at-middle-c.webp"
          alt="从背后看一位弹琴的人，她坐在立式钢琴的正中间，双手分别放在键盘中线的两侧。"
          caption="背后看：坐在键盘正中间，两只手分别在中央 C 两侧。"
        />
      </Section>

      <Section id="hand-shape" title="手型">
        <Picture
          src="learn/curved-hand.webp"
          alt="从侧面看放在琴键上的右手：手指自然弯曲，指尖落在琴键上，手腕与手背齐平。"
          caption="手指弯曲，像轻轻握着一个小球；大拇指用指尖侧面弹；手腕与手背齐平。"
        />
        <p>
          先让手臂自然垂在身侧，再保持手的形状抬到琴键上：手指会自然弯成一道弧。用指尖弹，不要用平平的指腹；大拇指用指尖外侧弹。手腕保持平，既不塌到琴键下面，也不高过手背。
        </p>
        <Aside title="保持放松">
          <p>
            如果手、手腕或肩膀觉得紧，就停下来甩一甩。紧张会让弹琴更费劲，忍着疼痛继续弹可能会受伤。
          </p>
        </Aside>
      </Section>

      <Section id="finger-numbers" title="指法数字">
        <p>
          钢琴谱给两只手的手指用同一套编号：大拇指是 <strong>1</strong>，食指 <strong>2</strong>
          ，中指 <strong>3</strong>，无名指 <strong>4</strong>，小指 <strong>5</strong>。
        </p>
        <FingerNumbers
          alt="两只手掌心朝下，手指分开，两个大拇指相对。"
          left="左手"
          right="右手"
          caption="两只手都是大拇指为 1、小指为 5，编号左右对称。"
        />
        <p>需要用某个特定手指时，乐谱会把数字印在音符上方：</p>
        <Plate caption="C、D、E、F、G 上方的 1 到 5：右手的第一个把位。">
          <FingeringOnStaff label="上方标有指法数字的五个音" />
        </Plate>
      </Section>

      <Section id="five-fingers" title="五指位置">
        <p>
          让右手每个手指各对准一个白键，大拇指放在中央 C：1 在 C，2 在 D，3 在 E，4 在 F，5 在
          G。左手低一个八度、左右对称：小指在 C3，大拇指在 G3。这就是<strong>C 把位</strong>
          ，很多入门曲子自始至终都在这个位置上。
        </p>
        <Plate caption="每个键都标出了弹它的手指。">
          <FivePosition labels={{ left: '左手', right: '右手', both: '双手' }} />
        </Plate>
      </Section>

      <Section id="try-it" title="试一试">
        <p>一个手指对一个键，上去再下来，保持手指弯曲。看着标出的手指弹，不要只看键。</p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[60, 62, 64, 65, 67, 65, 64, 62, 60]}
            fingers={[1, 2, 3, 4, 5, 4, 3, 2, 1]}
            prompt="右手，大拇指从中央 C 开始。"
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[48, 50, 52, 53, 55, 53, 52, 50, 48]}
            fingers={[5, 4, 3, 2, 1, 2, 3, 4, 5]}
            prompt="左手，小指从 C3 开始。"
            onComplete={complete}
          />
        </Plate>
        <p>
          保持这个手型，后面学什么都会更顺。接下来，「弹奏」「识谱」和入门「曲目」会把这些都用起来。
        </p>
      </Section>
    </>
  );
}
