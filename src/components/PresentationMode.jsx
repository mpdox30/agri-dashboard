// src/components/PresentationMode.jsx
//
// โหมดนำเสนอเต็มจอสำหรับประชุม: แสดงทีละสไลด์ เลื่อนด้วยลูกศร/ช่องว่าง/คลิกปุ่ม กด Esc ออก
// ใช้ข้อมูลและคอมโพเนนต์ชุดเดียวกับหน้าเว็บ จึงไม่มีตัวเลขที่ต่างจากหน้าจอปกติ
import { useCallback, useEffect, useRef, useState } from 'react';
import './PresentationMode.css';

/**
 * props:
 *   slides: { key: string, title: string, node: ReactNode }[]
 *   onExit: () => void
 */
export default function PresentationMode({ slides, onExit }) {
  const [index, setIndex] = useState(0);
  const rootRef = useRef(null);
  const total = slides.length;

  const go = useCallback((delta) => setIndex((i) => Math.max(0, Math.min(total - 1, i + delta))), [total]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    root.focus();
    // ขอเต็มจอ (ผู้ใช้ปฏิเสธหรือเบราว์เซอร์ไม่รองรับก็ยังใช้ได้ในกรอบหน้าต่าง)
    if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
    function handleFullscreenChange() {
      if (!document.fullscreenElement) onExit();
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onExit]);

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      onExit();
    } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      go(1);
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'Home') {
      setIndex(0);
    } else if (event.key === 'End') {
      setIndex(total - 1);
    }
  }

  const slide = slides[index];

  return (
    <div
      ref={rootRef}
      className="present"
      role="dialog"
      aria-modal="true"
      aria-label="โหมดนำเสนอ"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="present__progress" aria-hidden="true">
        <i style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <header className="present__bar">
        <div className="present__heading">
          <span className="present__count">{index + 1} / {total}</span>
          <h2 className="present__title">{slide.title}</h2>
        </div>
        <button type="button" className="present__exit" onClick={onExit}>
          ออกจากโหมดนำเสนอ (Esc)
        </button>
      </header>

      <div className="present__stage" key={slide.key}>
        {slide.node}
      </div>

      <footer className="present__foot">
        <button type="button" className="present__nav" onClick={() => go(-1)} disabled={index === 0} aria-label="สไลด์ก่อนหน้า">
          ‹
        </button>
        <div className="present__dots" role="tablist" aria-label="เลือกสไลด์">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`สไลด์ ${i + 1}: ${s.title}`}
              className={i === index ? 'present__dot is-active' : 'present__dot'}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <button type="button" className="present__nav" onClick={() => go(1)} disabled={index === total - 1} aria-label="สไลด์ถัดไป">
          ›
        </button>
      </footer>
    </div>
  );
}
