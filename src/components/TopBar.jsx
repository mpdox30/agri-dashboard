// src/components/TopBar.jsx
import { useEffect, useState } from 'react';
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

  return (
    <div className={stuck ? 'topbar is-stuck' : 'topbar'}>
      <div className="topbar__brand">
        <img className="topbar__logo" src={sasanLogo} alt="สถาบันสารสนเทศทรัพยากรน้ำ (สสน.)" />
        <div className="topbar__text">
          ระบบติดตามรายได้แปลงเกษตรทฤษฎีใหม่
          <span>Hydro-Informatics Institute · ฝ่ายจัดการน้ำชุมชน</span>
        </div>
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
