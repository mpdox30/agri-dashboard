// src/components/ui/Reveal.jsx
//
// เนื้อหาค่อยๆ ผุดขึ้นเมื่อเลื่อนมาถึง (ครั้งเดียว) — ถ้าปิดการเคลื่อนไหวหรือกำลังส่งออกไฟล์
// จะแสดงครบทันที (ดู motion.js และกฎ .reveal ใน ui.css)
import useInView from './useInView';
import { useMotionDisabled } from './motion';
import './ui.css';

export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const motionOff = useMotionDisabled();
  const [ref, inView] = useInView({ disabled: motionOff });
  const classes = ['reveal', inView ? 'in' : '', className].filter(Boolean).join(' ');
  const mergedStyle = delay ? { ...style, transitionDelay: `${delay}ms` } : style;
  return (
    <Tag ref={ref} className={classes} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
}
