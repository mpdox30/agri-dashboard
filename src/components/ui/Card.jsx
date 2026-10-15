// src/components/ui/Card.jsx
//
// การ์ดซ้อนสองชั้น: เปลือกนอกสีจางบางๆ ห่อเนื้อในสีครีมสว่าง ให้ความรู้สึกเป็นวัตถุที่มีมิติ
// ใช้โทนกระดาษอุ่นของเว็บเรา (ไม่ใช่ฟ้าเย็นแบบเว็บต้นแบบ) — ดูตัวแปรใน tokens.css
import './ui.css';

export default function Card({ as: Tag = 'div', tone, className = '', children, ...rest }) {
  const classes = ['ui-card', tone ? `ui-card--${tone}` : '', className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      <div className="ui-card__core">{children}</div>
    </Tag>
  );
}
