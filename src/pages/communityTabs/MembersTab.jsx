// src/pages/communityTabs/MembersTab.jsx
import { useMemo, useState } from 'react';
import './MembersTab.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

const SORT_OPTIONS = [
  { value: 'netIncome', label: 'เรียงตามรายได้สุทธิ' },
  { value: 'name', label: 'เรียงตามชื่อ' },
  { value: 'joinYear', label: 'เรียงตามปีที่เข้าร่วม' },
];

/**
 * props:
 *   members: ผลลัพธ์จาก buildMemberTable() — เรียงตามรายได้สุทธิมาก->น้อยมาแล้ว
 *   periodLabel: ข้อความอธิบายช่วงเวลาที่กำลังดู (เช่น "ปีงบ 68–69 · ทั้งปี")
 */
export default function MembersTab({ members, periodLabel }) {
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('netIncome');

  const filteredSorted = useMemo(() => {
    let result = members;
    if (searchText.trim() !== '') {
      const q = searchText.trim().toLowerCase();
      result = result.filter((m) => m.fullName.toLowerCase().includes(q));
    }
    result = [...result];
    if (sortBy === 'name') {
      result.sort((a, b) => a.fullName.localeCompare(b.fullName, 'th'));
    } else if (sortBy === 'joinYear') {
      result.sort((a, b) => Number(a.joinYear || 0) - Number(b.joinYear || 0));
    } else {
      result.sort((a, b) => b.netIncome - a.netIncome);
    }
    return result;
  }, [members, searchText, sortBy]);

  const maxNetIncome = Math.max(1, ...members.map((m) => Math.abs(m.netIncome)));

  return (
    <div className="section">
      <div className="section-head">
        <h2>รายสมาชิก — {periodLabel}</h2>
        <span className="note">{members.length} สมาชิก</span>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="ค้นหาชื่อสมาชิก..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="empty-note">ไม่พบสมาชิกที่ตรงกับคำค้นหา</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>สมาชิก</th>
              <th className="num">ขาย</th>
              <th className="num">ซื้อ</th>
              <th className="num">แบ่งปัน</th>
              <th className="num">รายได้สุทธิ</th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((m) => {
              // อันดับอ้างอิงจากลิสต์เต็ม (ก่อนค้นหา) ให้สอดคล้องกับ "อันดับจริง" เสมอ
              const rankInFull = members.findIndex((x) => x.fullName === m.fullName) + 1;
              const rankClass =
                rankInFull === 1 ? 'top1' : rankInFull === 2 ? 'top2' : rankInFull === 3 ? 'top3' : '';
              const barWidthPct = (Math.abs(m.netIncome) / maxNetIncome) * 100;
              return (
                <tr key={m.fullName}>
                  <td>
                    <span className={`rank-badge ${rankClass}`}>{rankInFull}</span>
                    <span className="member-name">{m.fullName}</span>
                    <div className="member-sub">เข้าร่วมปี {m.joinYear || 'ไม่ระบุ'}</div>
                  </td>
                  <td className="num">{formatBaht(m.sale)}</td>
                  <td className="num">{formatBaht(m.purchase)}</td>
                  <td className="num">{formatBaht(m.sharing)}</td>
                  <td className="num">
                    <span className="mini-bar-track">
                      <span className="mini-bar-fill" style={{ width: `${barWidthPct}%` }} />
                    </span>
                    {formatBaht(m.netIncome)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
