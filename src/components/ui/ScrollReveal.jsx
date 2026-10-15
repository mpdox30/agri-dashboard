// src/components/ui/ScrollReveal.jsx
//
// ห่อเนื้อหาทั้งแท็บ แล้วทำให้การ์ด/กราฟ/ลิสต์ข้างในผุดขึ้นเมื่อเลื่อนมาเห็น (ทีละใบเหลื่อมกัน)
// ใช้แอตทริบิวต์ data-rv ที่ตั้งผ่าน DOM ตรงๆ (0 = ยังไม่เห็น, 1 = เห็นแล้ว) แทนการแก้ทุกการ์ดทีละตัว
// ไม่ยุ่งกับ className ที่ React คุมอยู่ จึงไม่ถูกเขียนทับตอนเรนเดอร์ซ้ำ
// ลูกเล่นภายในการ์ด (แถบเติม เส้นวาด กราฟแท่งโต) ผูกกับ data-rv นี้ผ่าน scrollReveal.css
import { useEffect, useRef } from 'react';
import './scrollReveal.css';

const SELECTOR = [
  '.stat-row-card',
  '.composition-card',
  '.retention-card',
  '.season-card',
  '.chart-section-card',
  '.rank-card',
  '.profile-compare-card',
  '.peer-rank-card',
].join(',');

export default function ScrollReveal({ children, className = '' }) {
  const rootRef = useRef(null);

  // รันทุกครั้งที่เรนเดอร์ เพื่อจับการ์ดที่เพิ่งโผล่ (เช่น โหลดข้อมูลเสร็จทีหลัง) แต่ข้ามตัวที่ตั้งไว้แล้ว
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const fresh = Array.from(root.querySelectorAll(SELECTOR)).filter((el) => !el.hasAttribute('data-rv'));
    if (!fresh.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-rv', '1');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    fresh.forEach((el) => {
      const siblings = el.parentElement ? Array.from(el.parentElement.children) : [el];
      el.style.setProperty('--rv-d', `${Math.min(siblings.indexOf(el), 5) * 90}ms`);
      el.setAttribute('data-rv', '0');
      observer.observe(el);
    });
    return () => observer.disconnect();
  });

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
