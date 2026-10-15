// src/components/SubTabs.jsx
//
// แท็บย่อย เส้นใต้สีดินเผาเลื่อนไหลไปหาแท็บที่เลือก (ตำแหน่ง/ความกว้างเขียนลงตัวแปร CSS ตรงๆ ไม่ผ่าน state)
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import './SubTabs.css';

/**
 * props:
 *   tabs: { key: string, label: string, count?: number | string }[]
 *   activeKey: string
 *   onChange: (key: string) => void
 */
export default function SubTabs({ tabs, activeKey, onChange }) {
  const rootRef = useRef(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const on = root.querySelector('.subtab-btn.active');
    if (!on) return;
    root.style.setProperty('--x', `${on.offsetLeft}px`);
    root.style.setProperty('--w', `${on.offsetWidth}px`);
    root.setAttribute('data-ready', '');
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [activeKey, tabs, measure]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className="subtabs" ref={rootRef}>
      <span className="subtabs__ind" aria-hidden="true" />
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeKey === tab.key ? 'subtab-btn active' : 'subtab-btn'}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
