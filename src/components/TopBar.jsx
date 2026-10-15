// src/components/TopBar.jsx
import { useEffect, useRef, useState } from 'react';
import sasanLogo from '../assets/sasan-logo.png';
import './TopBar.css';

const MODES = [
  { key: 'public', label: 'ภาพรวม (สาธารณะ)' },
  { key: 'internal', label: 'ข้อมูลเชิงวิเคราะห์' },
  { key: 'entry', label: 'กรอกข้อมูล' },
  { key: 'approval', label: 'ตรวจสอบ/อนุมัติ' },
  { key: 'dataquality', label: 'คุณภาพข้อมูล' },
  { key: 'executive', label: 'รายงานผู้บริหาร' },
];

/**
 * props:
 *   activeMode: 'public' | 'internal' | 'entry' | 'approval' | 'dataquality' | 'executive'
 *   onModeChange: (mode: string) => void
 */
export default function TopBar({ activeMode, onModeChange }) {
  // เลื่อนลงแล้วแถบเกาะขอบบนพร้อมเงาบางๆ (เปลี่ยน state เฉพาะตอนข้ามเส้น ไม่ใช่ทุกพิกเซลที่เลื่อน)
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // จอแคบ/แท็บเล็ต: เมนูโหมดพับเป็นปุ่มเดียว กดแล้วเปิดรายการแนวตั้ง (ไม่ต้องเลื่อนแนวนอนหาเมนู)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const activeLabel = (MODES.find((m) => m.key === activeMode) || MODES[0]).label;

  return (
    <div className={stuck ? 'topbar is-stuck' : 'topbar'}>
      <div className="topbar__brand">
        <img className="topbar__logo" src={sasanLogo} alt="สถาบันสารสนเทศทรัพยากรน้ำ (สสน.)" />
        <div className="topbar__text">
          ระบบติดตามรายได้แปลงเกษตรทฤษฎีใหม่
          <span>Hydro-Informatics Institute · ฝ่ายจัดการน้ำชุมชน</span>
        </div>
      </div>
      <div className="topbar__menu" ref={menuRef}>
        <button
          type="button"
          className="topbar__menu-btn"
          aria-expanded={menuOpen}
          aria-controls="topbar-menu-list"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="topbar__menu-label">{activeLabel}</span>
          <svg className="topbar__menu-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {menuOpen && (
          <ul className="topbar__menu-list" id="topbar-menu-list">
            {MODES.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  className={activeMode === m.key ? 'active' : ''}
                  aria-current={activeMode === m.key ? 'page' : undefined}
                  onClick={() => {
                    setMenuOpen(false);
                    onModeChange(m.key);
                  }}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="topbar__mode-toggle">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={activeMode === m.key ? 'active' : ''}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
