// src/components/DigestCard.jsx
//
// การ์ด "สัญญาณจากข้อมูล" สำหรับผู้บริหาร: สรุปสิ่งที่ควรดูก่อน สร้างจากกฎตายตัว (ดู digestData.js)
import Card from './ui/Card';
import Reveal from './ui/Reveal';
import './DigestCard.css';

const TONE_MARK = { up: '▲', down: '▼', info: '●' };
const TONE_WORD = { up: 'เพิ่มขึ้น', down: 'ลดลง', info: 'ข้อสังเกต' };

/**
 * props:
 *   items: ผลจาก buildDigest()
 *   onFocusCommunity: (key) => void
 */
export default function DigestCard({ items, onFocusCommunity }) {
  return (
    <Reveal className="digest">
      <Card>
        <div className="digest__title">สัญญาณจากข้อมูล</div>
        {items.length === 0 ? (
          <p className="digest__empty">ยังไม่พบรายการที่โดดเด่นเป็นพิเศษในขอบเขตที่เลือก</p>
        ) : (
          <ul className="digest__list">
            {items.map((it) => (
              <li key={it.key} className={`digest__item digest__item--${it.tone}`}>
                <span className="digest__mark" aria-hidden="true">{TONE_MARK[it.tone]}</span>
                <span className="sr-only">{TONE_WORD[it.tone]}: </span>
                <span className="digest__text">{it.text}</span>
                {it.communityKey && (
                  <button type="button" className="digest__go" onClick={() => onFocusCommunity(it.communityKey)}>
                    ดูชุมชนนี้
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="digest__note">
          สร้างอัตโนมัติจากกฎตายตัว เทียบกับเดือนเดียวกันของปีก่อน เฉพาะชุมชนที่มีเดือนเทียบได้อย่างน้อย 3 เดือน
          รายได้เกษตรผันผวนตามฤดูกาลเป็นปกติ จึงควรใช้เป็นจุดเริ่มสอบถามเท่านั้น
        </p>
      </Card>
    </Reveal>
  );
}
