import type { TempoName } from '../../../core/tempoNames.ts';
import { Articulation, DynamicLevels, Hairpins } from '../expressionFigures.tsx';
import { Plate } from '../kit.tsx';
import { FermataPhrase, TempoChange, TempoScale, type TempoChangeKind } from '../tempoFigures.tsx';
import type { TermTexts } from './index.ts';

const TOUCHES = {
  legato: {
    name: '連奏',
    text: '下一個鍵按下時，才放開上一個鍵；第一條圓滑線結束的地方換一口氣。',
  },
  nonLegato: { name: '非連奏', text: '每個音彈滿大半個時值，音和音之間稍微分開。' },
  staccato: { name: '斷奏', text: '短：只彈一半時值或更短，其餘是空白。' },
  tenuto: { name: '持音', text: '彈滿整個時值，稍微帶一點重量。' },
};

function Scale({ mark, caption }: { mark: TempoName; caption: string }) {
  return (
    <Plate caption={caption}>
      <TempoScale mark={mark} label="各個速度術語，以及它們在節拍器上每分鐘的拍數" />
    </Plate>
  );
}

function Change({ kind, caption }: { kind: TempoChangeKind; caption: string }) {
  return (
    <Plate caption={caption}>
      <TempoChange kind={kind} label="排在一條線上的拍子，間距和時間成正比" />
    </Plate>
  );
}

const MARK_CAPTION = '它在速度術語中的位置。點任何一個術語，聽它的速度彈八拍。';

const TEXTS: TermTexts = {
  tempo: () => (
    <>
      <p>
        義大利文的速度術語不只說快慢，也說情緒：allegro
        的本義是「歡快」，然後才是「快」。節拍器記號把速度定下來，術語則給出性格。
      </p>
      <p>很多樂曲只寫了術語。這時速度由你判斷，上限是你能把最快的那些音彈乾淨。</p>
      <Scale mark="andante" caption={MARK_CAPTION} />
    </>
  ),

  'metronome-mark': () => (
    <>
      <p>
        記號裡的音符就是按哪種音符數拍。6/8 拍裡 ♩. = 60 數的是附點四分音符；慢的 2/2 拍裡，二分音符
        = 60 數的就是二分音符。
      </p>
      <p>
        M.M. 是「梅爾策爾節拍器」的縮寫，他在 1815
        年為節拍器申請了專利。貝多芬是最早在樂譜上寫節拍器記號的作曲家之一。
      </p>
      <Scale mark="allegro" caption="♩ = 120 正好是快板開始的地方。點任何一個術語，聽它的速度。" />
    </>
  ),

  grave: () => (
    <>
      <p>
        義大利文「沉重、嚴肅」。它是最慢的速度術語，常常寫在快樂章前面那段緩慢、厚重的序奏上，例如貝多芬《悲愴奏鳴曲》的開頭。
      </p>
      <Scale mark="grave" caption={MARK_CAPTION} />
    </>
  ),

  largo: () => (
    <>
      <p>
        義大利文「寬廣」。要的是慢而飽滿、舒展的聲音，而不是拖拖拉拉。德弗札克《新世界交響曲》的慢樂章就是廣板。
      </p>
      <Scale mark="largo" caption={MARK_CAPTION} />
    </>
  ),

  larghetto: () => (
    <>
      <p>
        largo
        的指小形式，「稍寬廣」。仍然是慢的，但比較輕，往前走得多一點。莫札特《單簧管五重奏》的慢樂章就是小廣板。
      </p>
      <Scale mark="larghetto" caption={MARK_CAPTION} />
    </>
  ),

  adagio: () => (
    <>
      <p>
        來自 ad agio，「從容地」。寫著 Adagio
        的慢樂章實在太多，這個詞本身也成了慢樂章的代稱。貝多芬《月光奏鳴曲》第一樂章是 Adagio
        sostenuto。
      </p>
      <Scale mark="adagio" caption={MARK_CAPTION} />
    </>
  ),

  andante: () => (
    <>
      <p>
        來自 andare，「走」：走路的速度，是往前走，不是慢。海頓《驚愕交響曲》的第二樂章就是行板。
      </p>
      <p>andantino 通常比 andante 稍快一點，不過作曲家們對此並不總是一致。</p>
      <Scale mark="andante" caption={MARK_CAPTION} />
    </>
  ),

  moderato: () => (
    <>
      <p>
        不快不慢。它常常修飾別的詞：allegro moderato 是適中的快板，andante moderato 是穩定的行板。
      </p>
      <Scale mark="moderato" caption={MARK_CAPTION} />
    </>
  ),

  allegro: () => (
    <>
      <p>
        義大利文「歡快、活潑」，在音樂裡漸漸成了「快」的意思。奏鳴曲的第一樂章和末樂章大多是快板。allegretto
        是「稍快板」，比較輕巧，也沒那麼快。
      </p>
      <Scale mark="allegro" caption={MARK_CAPTION} />
    </>
  ),

  presto: () => (
    <>
      <p>義大利文「迅速、敏捷」。比快板更快：貝多芬《月光奏鳴曲》末樂章是 Presto agitato。</p>
      <Scale mark="presto" caption={MARK_CAPTION} />
    </>
  ),

  prestissimo: () => (
    <>
      <p>presto 的最高級：在還能把音彈乾淨的前提下盡量快。很少見，通常只用在結尾的一小段。</p>
      <Scale mark="prestissimo" caption={MARK_CAPTION} />
    </>
  ),

  ritardando: () => (
    <>
      <p>
        ritardando 和 rallentando
        都是一點一點放慢，大部分演奏者把它們當成同一回事。ritenuto（riten.）不同：是立刻慢下來，不是逐漸的。
      </p>
      <Change kind="rit" caption="先是四拍平穩的拍子，然後漸慢：每個間隔都比上一個長一點。" />
    </>
  ),

  accelerando: () => (
    <>
      <p>
        要一拍一拍均勻地加快，不能一下子跳快。stringendo（「收緊」）也是加快，通常伴隨著越來越緊張。
      </p>
      <Change kind="accel" caption="先是四拍平穩的拍子，然後漸快：每個間隔都比上一個短一點。" />
    </>
  ),

  'a-tempo': () => (
    <>
      <p>
        它取消前面的 rit.、accel. 或 rubato，拍子回到之前的速度。Tempo primo（Tempo
        I）是在另一個速度的段落之後，回到全曲開頭的速度。
      </p>
      <Change kind="atempo" caption="平穩，漸慢，然後 a tempo：立刻回到原來的速度。" />
    </>
  ),

  rubato: () => (
    <>
      <p>
        義大利文「被偷走的」。一個音拉長一點，時間就從周圍的音那裡借來，樂句先放寬，再趕回來。左手常常比上面的旋律守拍更穩。
      </p>
      <p>它首先屬於浪漫樂派的音樂，尤其是蕭邦的。用得太多，拍子就不見了。</p>
    </>
  ),

  fermata: () => (
    <>
      <p>
        停多久由演奏者決定，常見的是寫的時值的兩倍左右。寫在休止符上，就是停住的一段安靜；寫在全曲最後一個和弦上，讓聲音自己消失。
      </p>
      <Plate caption="一個停在 G 上的樂句，分別聽有延長記號和沒有的樣子。">
        <FermataPhrase
          label="C、B、A，然後是帶延長記號的 G，再到 C"
          labels={{ held: '有延長記號', plain: '沒有' }}
        />
      </Plate>
    </>
  ),

  'dynamic-marks': () => (
    <>
      <p>
        這些字母來自義大利文：p 是 piano，弱；f 是 forte，強；m 是
        mezzo，「中」。從弱到強：pp、p、mp、mf、f、ff。
      </p>
      <p>它們是相對的。搖籃曲裡的 f 和進行曲裡的 f 不一樣，每臺琴、每個房間聽起來也不一樣。</p>
      <Plate caption="選一個力度，聽同一個樂句用它來彈。">
        <DynamicLevels
          staffLabel="高音譜表上〈快樂頌〉的開頭，下方有一個力度記號"
          labels={{
            all: '從 pp 到 ff',
            levels: {
              pp: { name: 'pianissimo', meaning: '甚弱' },
              p: { name: 'piano', meaning: '弱' },
              mp: { name: 'mezzo-piano', meaning: '中弱' },
              mf: { name: 'mezzo-forte', meaning: '中強' },
              f: { name: 'forte', meaning: '強' },
              ff: { name: 'fortissimo', meaning: '甚強' },
            },
          }}
        />
      </Plate>
    </>
  ),

  crescendo: () => (
    <>
      <p>
        義大利文「增長」。它從前面的力度出發，到後面的力度為止；後面沒寫力度時，強到什麼程度由你決定。開始時要弱得留有餘地。
      </p>
      <Plate caption="同一個起伏，分別用楔形記號和文字寫出來。">
        <Hairpins
          staffLabel="九個音符上行到 G 再回來，下方有漸強和漸弱記號"
          labels={{ hairpins: '楔形記號', words: '文字' }}
        />
      </Plate>
    </>
  ),

  diminuendo: () => (
    <>
      <p>
        義大利文「減少」；decrescendo 意思一樣。跨好幾個小節的長漸弱，常用來結束一個樂句或整首樂曲。
      </p>
      <Plate caption="同一個起伏，分別用楔形記號和文字寫出來。">
        <Hairpins
          staffLabel="九個音符上行到 G 再回來，下方有漸強和漸弱記號"
          labels={{ hairpins: '楔形記號', words: '文字' }}
        />
      </Plate>
    </>
  ),

  legato: () => (
    <>
      <p>
        義大利文「連起來的」。一個鍵抬起的同時下一個鍵按下，音和音之間聲音不斷。圓滑線結束的地方，換一小口氣。
      </p>
      <Plate caption="同一條旋律，連奏和非連奏。自己彈一遍，時間線會顯示你是怎麼把音連起來的。">
        <Articulation
          touches={['legato', 'nonLegato']}
          labels={TOUCHES}
          staffLabel="從 C 上行到 G 再回來的九個音，帶兩條圓滑線或不帶"
        />
      </Plate>
    </>
  ),

  staccato: () => (
    <>
      <p>
        義大利文「分開的」。點縮短的是音，不是拍：下一個音照樣準時進來，中間是一段空白。楔形的短斷奏（staccatissimo）更短。
      </p>
      <Plate caption="同一條旋律，斷奏和持音。自己彈一遍，時間線會顯示每個音你按了多久。">
        <Articulation
          touches={['staccato', 'tenuto']}
          labels={TOUCHES}
          staffLabel="從 C 上行到 G 再回來的九個音，上方帶點或短橫線"
        />
      </Plate>
    </>
  ),

  dolce: () => (
    <p>
      義大利文「甜的」。它說的是音色，也是音量：輕柔，觸鍵溫和，沒有生硬的稜角。常常和 p
      一起寫在一段旋律的開頭。
    </p>
  ),

  cantabile: () => (
    <p>
      義大利文「可以唱的」。讓旋律在伴奏之上唱起來：音要連，句子要像歌手換氣那樣有起伏，伴奏的那隻手要輕一些。蕭邦要學生多去聽優秀的歌唱家，來學這件事。
    </p>
  ),

  espressivo: () => (
    <p>
      它要的是樂句本來就有的東西再多一些：強弱起伏更大，音樂傾向的地方多給一點時間。常常只標在一個樂句、一段獨奏旋律，或主題再次出現的時候。
    </p>
  ),

  modifiers: () => (
    <>
      <p>它們放在所修飾的詞前面或後面，也可以疊起來用：poco più mosso，稍快一點。</p>
      <Plate>
        <table className="term-table">
          <thead>
            <tr>
              <th scope="col">詞</th>
              <th scope="col">意思</th>
              <th scope="col">例子</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">molto</th>
              <td>很、非常</td>
              <td>molto rit.：大幅漸慢</td>
            </tr>
            <tr>
              <th scope="row">poco</th>
              <td>稍微</td>
              <td>poco cresc.：稍漸強</td>
            </tr>
            <tr>
              <th scope="row">poco a poco</th>
              <td>一點一點地</td>
              <td>poco a poco accel.：逐漸加快</td>
            </tr>
            <tr>
              <th scope="row">più</th>
              <td>更</td>
              <td>più mosso：更有動力，更快</td>
            </tr>
            <tr>
              <th scope="row">meno</th>
              <td>較少</td>
              <td>meno mosso：動力少些，更慢</td>
            </tr>
            <tr>
              <th scope="row">sempre</th>
              <td>始終、一直</td>
              <td>sempre legato：一直連奏</td>
            </tr>
            <tr>
              <th scope="row">subito</th>
              <td>突然</td>
              <td>subito p：突然變弱</td>
            </tr>
            <tr>
              <th scope="row">non troppo</th>
              <td>不過分</td>
              <td>allegro ma non troppo：快，但不要太快</td>
            </tr>
          </tbody>
        </table>
      </Plate>
    </>
  ),
};

export default TEXTS;
