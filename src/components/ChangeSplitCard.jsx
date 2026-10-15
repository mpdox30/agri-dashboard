// src/components/ChangeSplitCard.jsx
//
// การ์ดสรุปว่าชุมชนกี่แห่ง รายได้เพิ่มขึ้น / ทรงตัว / ลดลง เมื่อเทียบกับเดือนเดียวกันของปีก่อน
// ใช้แถบสัดส่วนสีเดียวแบบสุภาพ ไม่ใช้สีเตือนแรง เพราะรายได้เกษตรผันผวนตามฤดูกาลเป็นปกติ
import { useState } from 'react';
import Card from './ui/Card';
import Reveal from './ui/Reveal';
import SegmentBar from './ui/SegmentBar';
import CountUp from './ui/CountUp';
import './ChangeSplitCard.css';

function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * props:
 *   split: { up, flat, down, total }  จาก splitCommunitiesByChange()
 *   pairedCount: จำนวนคู่ (ชุมชน, เดือน) ที่ใช้เทียบ
 */
export default function ChangeSplitCard({ split, pairedCount }) {
  const [hovered, setHovered] = useState(null);
  if (!split || split.total === 0) {
    return (
      <Reveal className="change-split">
        <Card>
          <div className="change-split__title">เทียบกับเดือนเดียวกันของปีก่อน</div>
          <p className="change-split__empty">ยังไม่มีเดือนที่มีข้อมูลทั้งสองปีให้เทียบในขอบเขตที่เลือก</p>
        </Card>
      </Reveal>
    );
  }
  const items = [
    { key: 'up', tone: 'up', label: 'รายได้เพิ่มขึ้น', value: split.up },
    { key: 'flat', tone: 'flat', label: 'ทรงตัว', value: split.flat },
    { key: 'down', tone: 'down', label: 'รายได้ลดลง', value: split.down },
  ];
  return (
    <Reveal className="change-split">
      <Card>
        <div className="change-split__title">เทียบกับเดือนเดียวกันของปีก่อน</div>
        <SegmentBar segments={items} activeKey={hovered} />
        <ul className="change-split__legend">
          {items.map((it) => (
            <li
              key={it.key}
              className={`change-split__item change-split__item--${it.tone}${hovered === it.key ? ' is-active' : ''}`}
              onMouseEnter={() => setHovered(it.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="change-split__dot" aria-hidden="true">{{ up: '▲', flat: '●', down: '▼' }[it.tone]}</span>
              <span className="change-split__num">
                <CountUp value={it.value} format={formatInteger} />
              </span>
              <span className="change-split__label">ชุมชน {it.label}</span>
            </li>
          ))}
        </ul>
        <p className="change-split__note">
          จาก {formatInteger(split.total)} ชุมชนที่มีเดือนเทียบได้ รวม {formatInteger(pairedCount)} เดือน
          เทียบเฉพาะเดือนที่มีข้อมูลทั้งสองปี ชุมชนที่เปลี่ยนไม่ถึง 2% นับว่าทรงตัว
        </p>
      </Card>
    </Reveal>
  );
}
