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
  major: '{tonic} 大調',
  minor: '{tonic} 小調',
  signature: (fifths) =>
    fifths === 0 ? '沒有升降記號' : `${Math.abs(fifths)} 個${fifths > 0 ? '升記號' : '降記號'}`,
  circle: '五度圈',
  staff: '高音譜表上的調號',
};

const TEXTS: TermTexts = {
  key: () => (
    <>
      <p>
        大部分的曲子最後都會回到同一個音上。這個音叫<strong>主音</strong>
        ，以它開頭、帶著相應升降記號的音階，就是這首曲子的調。G 大調的曲子用 G 大調音階裡的音，有
        F♯，停在 G 上聽起來才像結束。
      </p>
      <p>調要聽完一整句才聽得出來，光靠一個和弦聽不出：它是一組音，再加上其中一個當作家。</p>
      <Plate caption="選一個調：看它的音階，可以寫升降記號，也可以用調號。">
        <ScaleBuilder
          staffLabel="高音譜表上的大調音階"
          labels={{
            tonic: '調',
            accidentals: '寫升降記號',
            signature: '用調號',
            steps: '音階的每一步',
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
        有升記號時，最後一個升記號往上一個半音就是調名：F♯ C♯ 是 D
        大調。有降記號時，倒數第二個降記號就是調名：B♭ E♭ A♭ 是降 E 大調。一個降記號是 F
        大調，直接記起來。
      </p>
      <p>
        每個調號同時也屬於一個小調，在大調主音往下三個半音的地方：兩個升記號是 D 大調，也可能是 B
        小調。是哪一個，要聽音樂本身，尤其是最後一個和弦。
      </p>
      <Plate caption="選一個調，看它在兩行譜上的調號，升降記號按順序寫出名字。">
        <KeySignatures staffLabel="大譜表上的調號" none="沒有升降記號" />
      </Plate>
    </>
  ),

  'order-of-sharps-and-flats': () => (
    <>
      <p>
        每多一個升記號，都比前一個高五度（F、C、G⋯⋯）；每多一個降記號，都比前一個低五度（B、E、A⋯⋯）。所以調號不會跳著寫：三個升記號一定是
        F♯、C♯ 和 G♯。
      </p>
      <p>只要記住升記號的順序 F C G D A E B，倒過來唸就是降記號。</p>
      <Plate caption="先是七個升記號，再是七個降記號，每個記號下面寫著它的名字。">
        <SharpsAndFlats
          labels={{ sharps: '高音譜表上的七個升記號', flats: '高音譜表上的七個降記號' }}
        />
      </Plate>
    </>
  ),

  'circle-of-fifths': () => (
    <>
      <p>
        從最上面的 C 順時針讀：G 一個升記號，D 兩個，A 三個。反過來讀：F 一個降記號，降 B 兩個，降 E
        三個。兩邊在最下面相遇，F♯ 大調和降 G 大調是同一組鍵，只是名字不同。
      </p>
      <p>
        每個大調裡面一圈是它的關係小調，調號相同。圈上相鄰的兩個調只差一個音，所以音樂在鄰近的調之間轉換最自然。
      </p>
      <Plate caption="選一個調，外圈是大調，內圈是小調：譜上會出現它的調號，並彈出它的音階。">
        <CircleOfFifths labels={CIRCLE} />
      </Plate>
    </>
  ),

  'relative-keys': () => (
    <>
      <p>
        關係小調從大調音階的第 6 個音開始：C 大調是 A，G 大調是
        E。從大調主音往下三個半音就能找到它；從小調主音往上三個半音，就是它的關係大調。
      </p>
      <p>
        小調的曲子通常會把第 7 級升高（A 小調裡的
        G♯），寫成臨時記號。看到這個升記號，最容易分辨是小調還是它的關係大調。
      </p>
      <Plate caption="選一個大調，再切換到它的關係小調：同樣的音、同樣的調號，只是換了起點。">
        <RelativeMinor
          staffLabel="帶調號的大調音階或它的關係小調"
          labels={{
            key: '大調',
            majorName: '{tonic} 大調',
            minorName: '{tonic} 小調',
            readout: {
              major: '{minor} 小調從 {major} 大調的第 6 個音開始。',
              minor: '和 {major} 大調同樣的音、同樣的調號，從 {minor} 到 {minor}。',
            },
          }}
        />
      </Plate>
    </>
  ),

  'parallel-keys': () => (
    <>
      <p>
        主音一樣，音不一樣。C 小調把 C 大調裡的三個音降低了：E、A、B 變成
        E♭、A♭、B♭。最聽得出來的是三度：C–E 是大，C–E♭ 是小。
      </p>
      <p>
        作曲家常在兩者之間來回：C 小調的曲子最後停在 C
        大三和弦上，或是把一段旋律換成小調再唱一次，色彩就暗了下來。
      </p>
      <Plate caption="C 大調和 C 小調的〈兩隻老虎〉：只變了一個音，E 變成 E♭。">
        <MajorAndMinor
          staffLabel="高音譜表上的〈兩隻老虎〉"
          labels={{ major: 'C 大調', minor: 'C 小調' }}
        />
      </Plate>
    </>
  ),

  'scale-degrees': () => (
    <>
      <p>
        和聲主要靠其中三個。<strong>主音</strong>（1）是家。<strong>屬音</strong>
        （5）總想回到主音，建在它上面的和弦，幾乎是每首曲子最後一個和弦之前的那一個。
        <strong>下屬音</strong>
        （4）上的和弦，就是聖詩結尾「阿們」的那個和弦。
      </p>
      <p>
        <strong>導音</strong>
        （7）在主音下面一個半音，要往上走到主音。在小調裡，通常要把它升高，才會有這個半音。
      </p>
      <Plate caption="C 大調音階：每個音下面是它的級數，名字列在下面。">
        <DegreeScale
          label="高音譜表上的 C 大調音階"
          names={['主音', '上主音', '中音', '下屬音', '屬音', '下中音', '導音']}
        />
      </Plate>
    </>
  ),

  transposition: () => (
    <>
      <p>
        每個音都移動同樣的音程，音與音之間的距離不變，所以還是同一首曲子。從 C 移到 G，就要用 G
        大調的調號，一個升記號。
      </p>
      <p>
        歌手常把歌移到適合自己音域的調。在 dacapo 裡，樂曲頁面上可以把整首曲子按半音移高或移低。
      </p>
      <Plate caption="〈小星星〉第一句的三個調：音變了，旋律沒變。">
        <Transposed keyName="{tonic} 大調" label="高音譜表上的〈小星星〉" />
      </Plate>
    </>
  ),

  modulation: () => (
    <>
      <p>
        一個新的音反覆出現，就聽得出轉調了：C 大調的曲子裡 F 一再變成 F♯，接著一個終止式落在 G
        上。大調最常轉到它的屬調，小調最常轉到它的關係大調。
      </p>
      <p>
        最自然的辦法是借一個兩個調都有的和弦。A 小三和弦在 C 大調裡是 vi，在 G 大調裡是 ii；它後面的
        D7 只屬於 G 大調，於是 G 聽起來成了新的家。
      </p>
      <Plate caption="從 C 大調轉到 G 大調。A 小三和弦兩個調都有，D7 只屬於 G 大調。">
        <Modulation
          label="大譜表上的五個和弦，從 C 大調到 G 大調"
          numerals={['C: I', 'IV', 'vi = ii', 'G: V7', 'I']}
        />
      </Plate>
    </>
  ),

  'closely-related-keys': () => (
    <>
      <p>
        C 大調的近關係調是 G 大調和 F 大調，也就是五度圈上的兩個鄰居，再加上這三個大調的關係小調：A
        小調、E 小調和 D 小調。它們和 C 大調最多只差一個升記號或降記號。
      </p>
      <p>A 小調也是這五個：E 小調、D 小調、C 大調、G 大調和 F 大調。</p>
      <Plate caption="選一個調：它的近關係調會標出來。">
        <CircleOfFifths labels={CIRCLE} near />
      </Plate>
    </>
  ),
};

export default TEXTS;
