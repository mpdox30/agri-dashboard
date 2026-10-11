// src/components/TopBar.jsx
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
  return (
    <div className="topbar">
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
