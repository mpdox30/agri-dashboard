// src/components/ui/LoadingSkeleton.jsx
//
// โครงเปล่าแบบมีแสงวิ่ง (shimmer) แทนข้อความ "กำลังโหลด..." เฉยๆ รูปทรงเลียนแบบหน้าจริง
// ผู้ใช้จึงรู้ล่วงหน้าว่าเนื้อหาจะมาอยู่ตรงไหน และรู้สึกว่าระบบกำลังทำงานอยู่ ไม่ใช่ค้าง
// ตัวหนังสือ "กำลังโหลด..." ยังอยู่ให้โปรแกรมอ่านหน้าจอ (ซ่อนด้วย sr-only)
import './ui.css';

/**
 * props:
 *   variant: 'home' | 'community' | 'panel'
 *   label: ข้อความสำหรับโปรแกรมอ่านหน้าจอ
 */
export default function LoadingSkeleton({ variant = 'home', label = 'กำลังโหลดข้อมูล...' }) {
  const cards = variant === 'panel' ? 0 : 4;
  return (
    <div className={`skel skel--${variant}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {variant !== 'panel' && (
          <>
            <div className="skel__bar skel__bar--title" />
            <div className="skel__bar skel__bar--line" />
            <div className="skel__block skel__block--filter" />
          </>
        )}
        {cards > 0 && (
          <div className="skel__cards">
            {Array.from({ length: cards }, (_, i) => (
              <div className="skel__block skel__block--card" key={i} style={{ '--i': i }} />
            ))}
          </div>
        )}
        <div className="skel__block skel__block--chart" />
        {variant === 'panel' && <div className="skel__block skel__block--chart" style={{ '--i': 1 }} />}
      </div>
    </div>
  );
}
