// src/components/FloatingNav.jsx
//
// แถบนำทางลอยด้านล่างจอ (รูปแคปซูล) บอกว่าตอนนี้อ่านอยู่ส่วนไหน (scrollspy) และกดเพื่อเลื่อนไปยังส่วนนั้น
// หน้าแรกยาวมาก คนที่เปิดจากมือถือจะได้ไม่ต้องเลื่อนหาเอง
import { useEffect, useState } from 'react';
import { useReducedMotion } from './ui/motion';
import './FloatingNav.css';

/**
 * props:
 *   items: { id: string, label: string }[]  id คือ id ของ element ส่วนนั้นในหน้า เรียงตามลำดับบนหน้า
 */
export default function FloatingNav({ items }) {
  const [activeId, setActiveId] = useState(items.length ? items[0].id : null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const elements = items.map((it) => document.getElementById(it.id)).filter(Boolean);
    if (!elements.length) return undefined;
    // เส้นอ่านจินตนาการอยู่ราวร้อยละ 40 จากขอบบนของจอ ส่วนไหนคร่อมเส้นนี้ถือว่ากำลังอ่านส่วนนั้น
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -59% 0px', threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  function handleClick(event, id) {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    setActiveId(id);
  }

  return (
    <nav className="floating-nav" aria-label="ไปยังส่วนต่างๆ ของหน้า">
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={it.id === activeId ? 'floating-nav__link is-active' : 'floating-nav__link'}
              aria-current={it.id === activeId ? 'true' : undefined}
              onClick={(e) => handleClick(e, it.id)}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
