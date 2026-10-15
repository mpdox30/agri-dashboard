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
  '.cmp-card',
].join(',');

export default function ScrollReveal({ children, className = '' }) {
  const rootRef = useRef(null);
  const observerRef = useRef(null);

  // ตัวสังเกตการณ์ตัวเดียวตลอดอายุคอมโพเนนต์ (ถ้าสร้างใหม่ทุกรอบเรนเดอร์ การ์ดที่ยังไม่เข้าจอจะหลุดจากการสังเกตแล้วค้างซ่อนตลอด)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
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
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  // รันทุกครั้งที่เรนเดอร์ เพื่อจับการ์ดที่เพิ่งโผล่ (เช่น โหลดข้อมูลเสร็จทีหลัง)
  // observe ซ้ำกับตัวที่ยังเป็น 0 ได้อย่างปลอดภัย; ตัวที่เห็นแล้ว (1) จะถูกข้าม
  useEffect(() => {
    const root = rootRef.current;
    const observer = observerRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll(SELECTOR));
    if (!observer) {
      // เบราว์เซอร์ไม่มี IntersectionObserver: แสดงทุกใบเลย
      cards.forEach((el) => el.setAttribute('data-rv', '1'));
      return;
    }
    cards.forEach((el) => {
      if (el.getAttribute('data-rv') === '1') return;
      if (!el.hasAttribute('data-rv')) {
        const siblings = el.parentElement ? Array.from(el.parentElement.children) : [el];
        el.style.setProperty('--rv-d', `${Math.min(siblings.indexOf(el), 5) * 90}ms`);
        el.setAttribute('data-rv', '0');
      }
      observer.observe(el);
    });
  });

  // กันเหนียว: ถ้าผ่านไปสักพักแล้วยังมีการ์ดที่อยู่กลางจอแต่ค้างซ่อน (ผู้สังเกตการณ์พลาดด้วยเหตุใดก็ตาม) ให้แสดงเลย
  // เนื้อหาต้องไม่หายไปเพราะลูกเล่น
  useEffect(() => {
    const id = window.setInterval(() => {
      const root = rootRef.current;
      if (!root) return;
      root.querySelectorAll('[data-rv="0"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.8 && r.bottom > 0) el.setAttribute('data-rv', '1');
      });
    }, 1200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
