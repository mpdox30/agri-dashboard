// src/components/ui/kpiIcons.jsx
//
// ไอคอนเส้นบางสำหรับมุมขวาบนของการ์ด KPI (เป็นเครื่องประดับ ซ่อนจากโปรแกรมอ่านหน้าจอ)
// วาดเองเป็น SVG ขนาด 24 ใช้สี currentColor จึงเปลี่ยนตามโทนของการ์ด
const base = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

export const IconTrend = () => (
  <svg {...base}>
    <path d="M3 17l5.5-5.5 4 4L21 7" />
    <path d="M15 7h6v6" />
  </svg>
);

export const IconWallet = () => (
  <svg {...base}>
    <path d="M4 7.5A2.5 2.5 0 016.5 5H18a1 1 0 011 1v2" />
    <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
    <circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCommunity = () => (
  <svg {...base}>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19c.5-3 2.7-4.7 5.5-4.7s5 1.7 5.5 4.7" />
    <circle cx="17" cy="9.5" r="2.3" />
    <path d="M16.5 14.4c2.2.1 3.7 1.4 4.2 3.6" />
  </svg>
);

export const IconShield = () => (
  <svg {...base}>
    <path d="M12 3l7 2.8v5.4c0 4.4-2.9 7.9-7 9.8-4.1-1.9-7-5.4-7-9.8V5.8L12 3z" />
    <path d="M8.8 12.2l2.2 2.2 4.2-4.4" />
  </svg>
);

export const IconShare = () => (
  <svg {...base}>
    <path d="M12 20s-7-4.2-7-9.6A3.9 3.9 0 0112 8a3.9 3.9 0 017 2.4C19 15.8 12 20 12 20z" />
  </svg>
);

export const IconPerson = () => (
  <svg {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
  </svg>
);
