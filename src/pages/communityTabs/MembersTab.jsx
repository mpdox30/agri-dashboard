// src/pages/communityTabs/MembersTab.jsx
import { Fragment, useEffect, useMemo, useState } from 'react';
import MemberMonthlyChart from '../../components/MemberMonthlyChart';
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
 *   monthlySeriesByName: map ชื่อสมาชิก -> ผลลัพธ์จาก buildMemberMonthlySeries() ใช้วาดกราฟ
 *     เมื่อกดขยายแถว — คำนวณจาก selectedRange เต็มเสมอ (ดู CommunityView.jsx) ไม่ผูกกับ
 *     ตัวกรอง "เดือนเดียว" ของตารางนี้
 *   fullPeriodLabel: ป้ายกำกับช่วงเวลาเต็ม (ไม่รวมตัวกรองเดือน) ใช้เป็นคำบรรยายกราฟ
 */
export default function MembersTab({ members, periodLabel, monthlySeriesByName, fullPeriodLabel }) {
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('netIncome');
  const [expandedName, setExpandedName] = useState(null);

  // ถ้าสมาชิกที่กำลังขยายอยู่หายไปจากลิสต์ปัจจุบัน (เช่น เปลี่ยนชุมชน/ช่วงเวลา) ให้ยุบกราฟ
  // ทิ้งไปด้วย — แต่ไม่ยุบทุกครั้งที่แค่ค้นหา/เรียงลำดับใหม่ ตราบใดที่สมาชิกคนนั้นยังอยู่ในลิสต์
  useEffect(() => {
    if (expandedName && !members.some((m) => m.fullName === expandedName)) {
      setExpandedName(null);
    }
  }, [members, expandedName]);

  function toggleExpand(name) {
    setExpandedName((prev) => (prev === name ? null : name));
  }

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
              <th></th>
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
              const isExpanded = expandedName === m.fullName;
              const monthly = monthlySeriesByName ? monthlySeriesByName[m.fullName] : null;
              return (
                <Fragment key={m.fullName}>
                  <tr
                    className="member-row"
                    onClick={() => toggleExpand(m.fullName)}
                    aria-expanded={isExpanded}
                  >
                    <td className="expand-cell">
                      <span className={isExpanded ? 'expand-caret expanded' : 'expand-caret'}>▸</span>
                    </td>
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
                  {isExpanded && (
                    <tr className="member-detail-row">
                      <td colSpan={6}>
                        <div className="member-chart-card">
                          <div className="member-chart-title">
                            แนวโน้มรายเดือน — {m.fullName} ({fullPeriodLabel})
                          </div>
                          {monthly ? (
                            <MemberMonthlyChart monthly={monthly} />
                          ) : (
                            <div className="member-chart-empty">ไม่มีข้อมูลรายเดือนสำหรับสมาชิกคนนี้</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
