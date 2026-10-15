// src/components/ui/SegmentedControl.jsx
//
// ตัวเลือกแบบแถบ (เลือกได้ทีละหนึ่ง) ที่มีตัวชี้เลื่อนไหลไปหาปุ่มที่เลือก — ตำแหน่งและความกว้าง
// ของตัวชี้ถูกเขียนลงตัวแปร CSS (--x, --w) ตรงๆ ไม่ผ่าน state เพื่อไม่ให้เรนเดอร์ซ้ำ
// รองรับคีย์บอร์ด (ลูกศร, Home, End) ตามมาตรฐาน radiogroup
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import './ui.css';

/**
 * props:
 *   options: { value, label }[]
 *   value: ค่าที่เลือกอยู่
 *   onChange: (value) => void
 *   ariaLabel: ชื่อกลุ่มสำหรับโปรแกรมอ่านหน้าจอ
 */
export default function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }) {
  const rootRef = useRef(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const on = root.querySelector('[aria-checked="true"]');
    if (!on) return;
    root.style.setProperty('--x', `${on.offsetLeft}px`);
    root.style.setProperty('--w', `${on.offsetWidth}px`);
    root.dataset.ready = 'true';
  }, []);

  // วัดหลังทุกครั้งที่ค่าหรือตัวเลือกเปลี่ยน (ก่อนวาดภาพ จะได้ไม่เห็นตัวชี้กระโดด)
  useLayoutEffect(() => {
    measure();
  }, [measure, value, options]);

  // ฟอนต์เว็บโหลดเสร็จทีหลังทำให้ความกว้างปุ่มเปลี่ยน และหน้าจอปรับขนาดได้ จึงต้องวัดใหม่
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(root);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }
    return () => observer && observer.disconnect();
  }, [measure]);

  function handleKeyDown(event) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex((o) => o.value === value);
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else next = (index + 1) % options.length;
    onChange(options[next].value);
    const buttons = rootRef.current ? rootRef.current.querySelectorAll('button') : [];
    if (buttons[next]) buttons[next].focus();
  }

  return (
    <div
      ref={rootRef}
      className={`seg ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <span className="seg__ind" aria-hidden="true" />
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="seg__btn"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
