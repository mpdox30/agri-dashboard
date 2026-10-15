// src/components/BarTrendChart.jsx
//
// กราฟแท่งแนวโน้มแบบมีชีวิต ใช้ได้ทั้งรายเดือน (หน้าแรก) และรายปีงบ (แท็บภาพรวมชุมชน)
// - แท่งงอกขึ้นจากฐานทีละแท่งเมื่อเลื่อนมาเห็น (ปิดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหวหรือกำลังส่งออก)
// - ชี้/แตะ/โฟกัสด้วยคีย์บอร์ดที่แท่งใดก็เห็นค่าเต็มพร้อมจุลภาค แท่งอื่นจางลงเล็กน้อยให้สายตาจับที่แท่งนั้น
// - ติดป้าย "สูงสุด" และ "ล่าสุด" เฉพาะสองจุดสำคัญ ที่เหลืออ่านจากกล่องค่าหรือตาราง (ตัวเลขเต็ม 12 ป้ายแน่นเกินไป)
// - เส้นกริดจางๆ ช่วยเทียบความสูง และปุ่ม "ดูค่าเป็นตาราง" ให้ผู้ที่ต้องการตัวเลขเป๊ะๆ
import { useRef, useState } from 'react';
import useInView from './ui/useInView';
import { useMotionDisabled } from './ui/motion';
import DataTableToggle from './charts/DataTableToggle';
import './BarTrendChart.css';

const formatBaht = (n) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);

/**
 * props:
 *   items: { key: string, label: string, value: number | null }[]  value = null คือยังไม่มีข้อมูล (ไม่ใช่ 0 จริง)
 *   unit: หน่วยท้ายตัวเลข (ค่าเริ่มต้น "บาท")
 *   ariaLabel: คำอธิบายกราฟสำหรับโปรแกรมอ่านหน้าจอ
 *   tableLabel: หัวคอลัมน์แรกของตาราง (เช่น "เดือน" หรือ "ปีงบ")
 *   legend: ข้อความคำอธิบายใต้กราฟ (ไม่ใส่ก็ได้)
 */
export default function BarTrendChart({ items, unit = 'บาท', ariaLabel, tableLabel = 'ช่วงเวลา', legend }) {
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  const [active, setActive] = useState(null);
  const [edge, setEdge] = useState(null); // 'start' | 'end' เมื่อแท่งที่ชี้อยู่ชิดขอบกรอบจนป้ายจะล้น
  const plotRef = useRef(null);

  const activate = (key, el) => {
    setActive(key);
    if (!el || !plotRef.current) return;
    const col = el.getBoundingClientRect();
    const box = plotRef.current.getBoundingClientRect();
    const mid = col.left + col.width / 2;
    const HALF_LABEL = 52;
    setEdge(mid - box.left < HALF_LABEL ? 'start' : box.right - mid < HALF_LABEL ? 'end' : null);
  };

  const known = items.filter((it) => it.value !== null);
  const maxAbs = Math.max(1, ...known.map((it) => Math.abs(it.value)));
  const peakKey = known.length ? known.reduce((a, b) => (b.value > a.value ? b : a)).key : null;
  const latestKey = known.length ? known[known.length - 1].key : null;

  return (
    <div className="bars" ref={ref}>
      <div className="bars__plot" ref={plotRef}>
        <div className="bars__grid" aria-hidden="true">
          <span /><span /><span />
        </div>
        <ul className="bars__cols" role="list" aria-label={ariaLabel} onMouseLeave={() => setActive(null)}>
          {items.map((it, i) => {
            const has = it.value !== null;
            const heightPct = has ? Math.max((Math.abs(it.value) / maxAbs) * 100, 3) : 2;
            const isPeak = it.key === peakKey;
            const isLatest = it.key === latestKey;
            const dim = active !== null && active !== it.key;
            const showLabel = has && (isPeak || isLatest || active === it.key);
            const classes = [
              'bars__col',
              dim ? 'is-dim' : '',
              active === it.key ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li key={it.key} className={classes}>
                <button
                  type="button"
                  className="bars__hit"
                  aria-label={has ? `${it.label} ${formatBaht(it.value)} ${unit}` : `${it.label} ยังไม่มีข้อมูล`}
                  onMouseEnter={(e) => activate(it.key, e.currentTarget)}
                  onFocus={(e) => activate(it.key, e.currentTarget)}
                  onBlur={() => setActive(null)}
                  onClick={(e) => (active === it.key ? setActive(null) : activate(it.key, e.currentTarget))}
                >
                  <span className="bars__stage">
                    <span
                      className={[
                        'bars__bar',
                        !has ? 'bars__bar--empty' : it.value < 0 ? 'bars__bar--neg' : '',
                        isPeak ? 'bars__bar--peak' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        height: `${heightPct}%`,
                        transform: motionOff || inView ? 'scaleY(1)' : 'scaleY(0)',
                        transitionDelay: motionOff ? '0ms' : `${i * 55}ms`,
                      }}
                    />
                    {showLabel && (
                      <span
                        className={[
                          'bars__value',
                          isPeak && active !== it.key ? 'bars__value--peak' : '',
                          i === items.length - 1 || (active === it.key && edge === 'end') ? 'bars__value--end' : '',
                          i === 0 || (active === it.key && edge === 'start') ? 'bars__value--start' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{
                          bottom: `calc(${heightPct}% + 5px)`,
                          opacity: motionOff || inView || active === it.key ? 1 : 0,
                          transition: motionOff ? 'none' : `opacity 0.4s var(--ease-out) ${i * 55 + 500}ms`,
                        }}
                      >
                        {formatBaht(it.value)}
                        {isPeak && active !== it.key && <em>สูงสุด</em>}
                        {!isPeak && isLatest && active !== it.key && <em>ล่าสุด</em>}
                      </span>
                    )}
                  </span>
                  <span className="bars__label">{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {legend && <div className="bars__legend">{legend}</div>}
      <DataTableToggle
        columns={[
          { key: 'label', label: tableLabel },
          { key: 'value', label: `รายได้สุทธิ (${unit})`, align: 'right' },
        ]}
        rows={items.map((it) => ({ key: it.key, label: it.label, value: it.value === null ? null : formatBaht(it.value) }))}
        caption={ariaLabel}
      />
    </div>
  );
}
