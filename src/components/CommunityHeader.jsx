// src/components/CommunityHeader.jsx
import { useState } from 'react';
import { buildFiscalYearDropdownOptions, buildCalendarYearDropdownOptions, getPeriodDisplayLabel } from '../pages/fiscalYears';
import './CommunityHeader.css';

// สร้างจาก fiscalYears.js จุดเดียว — ไม่ต้องแก้ที่นี่เวลาขึ้นปีงบใหม่
const FISCAL_YEAR_OPTIONS = buildFiscalYearDropdownOptions();
const CALENDAR_YEAR_OPTIONS = buildCalendarYearDropdownOptions();

const MONTH_OPTIONS = [
  { value: 'all', label: 'ทั้งปี' },
  { value: '01', label: 'ม.ค.' },
  { value: '02', label: 'ก.พ.' },
  { value: '03', label: 'มี.ค.' },
  { value: '04', label: 'เม.ย.' },
  { value: '05', label: 'พ.ค.' },
  { value: '06', label: 'มิ.ย.' },
  { value: '07', label: 'ก.ค.' },
  { value: '08', label: 'ส.ค.' },
  { value: '09', label: 'ก.ย.' },
  { value: '10', label: 'ต.ค.' },
  { value: '11', label: 'พ.ย.' },
  { value: '12', label: 'ธ.ค.' },
];

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * props:
 *   communities: full community list (for the picker dropdown)
 *   selectedCommunity: object (the matched community row) or null
 *   communityKey: string
 *   yearType: 'fiscal' | 'calendar'
 *   year: string (fiscal year key เช่น '68-69' หรือปีปฏิทินเช่น '2026' ตาม yearType)
 *   month: string
 *   onChange: ({ communityKey, yearType, year, month }) => void
 *   memberCount: number of distinct members found in monthly_records for this community
 *   kpis: { netIncome, householdReduction, sharing, perMember, deltas: {...} } or null while loading
 */
export default function CommunityHeader({
  communities,
  selectedCommunity,
  communityKey,
  yearType,
  year,
  month,
  onChange,
  memberCount,
  kpis,
}) {
  const yearOptions = yearType === 'fiscal' ? FISCAL_YEAR_OPTIONS : CALENDAR_YEAR_OPTIONS;
  const periodLabel = getPeriodDisplayLabel(yearType, year);

  // ตัวกรอง "ภาค" เป็นแค่ตัวช่วยย่อรายชื่อใน dropdown ชุมชนให้สั้นลง ไม่ใช่ส่วนของข้อมูล
  // ที่หน้าอื่นต้องรู้ จึงเก็บเป็น state ภายในคอมโพเนนต์นี้เอง ไม่ต้องส่งขึ้นไปให้ CommunityView
  const [regionFilter, setRegionFilter] = useState('all');
  const regions = [...new Set(communities.map((c) => c.region).filter(Boolean))].sort();
  const communitiesInRegion =
    regionFilter === 'all' ? communities : communities.filter((c) => c.region === regionFilter);

  function handleRegionFilterChange(nextRegion) {
    setRegionFilter(nextRegion);
    // ถ้าชุมชนที่กำลังดูอยู่ไม่อยู่ในภาคใหม่ที่เลือก สลับไปชุมชนแรกของภาคนั้นให้อัตโนมัติ
    const stillValid = nextRegion === 'all' || communities.find((c) => c.community_key === communityKey)?.region === nextRegion;
    if (!stillValid) {
      const inRegion = communities.filter((c) => c.region === nextRegion);
      if (inRegion.length > 0) {
        onChange({ communityKey: inRegion[0].community_key, yearType, year, month });
      }
    }
  }

  function handleYearTypeChange(nextType) {
    const defaultYear = nextType === 'fiscal' ? FISCAL_YEAR_OPTIONS[0].value : CALENDAR_YEAR_OPTIONS[0].value;
    onChange({ communityKey, yearType: nextType, year: defaultYear, month });
  }

  return (
    <div className="comm-hero">
      <div className="comm-breadcrumb">
        {selectedCommunity ? (
          <>
            <span>ภาพรวม</span> · <span>{selectedCommunity.region}</span> ·{' '}
            <span>{selectedCommunity.province}</span> · {selectedCommunity.community_key}
          </>
        ) : (
          <span>เลือกชุมชน</span>
        )}
      </div>

      <div className="comm-picker-row">
        <div className="control-group">
          <label>ภาค</label>
          <select value={regionFilter} onChange={(e) => handleRegionFilterChange(e.target.value)}>
            <option value="all">ทุกภาค ({regions.length})</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group wide">
          <label>ชุมชน</label>
          <select
            value={communityKey}
            onChange={(e) => onChange({ communityKey: e.target.value, yearType, year, month })}
          >
            {communitiesInRegion.map((c) => (
              <option key={c.community_key} value={c.community_key}>
                ชุมชน{c.community_key} ({c.province})
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>ประเภทปี</label>
          <div className="seg-toggle">
            <button
              type="button"
              className={yearType === 'fiscal' ? 'active' : ''}
              onClick={() => handleYearTypeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
            <button
              type="button"
              className={yearType === 'calendar' ? 'active' : ''}
              onClick={() => handleYearTypeChange('calendar')}
            >
              ปีปฏิทิน
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>{yearType === 'fiscal' ? 'ปีงบประมาณ' : 'ปี'}</label>
          <select
            value={year}
            onChange={(e) => onChange({ communityKey, yearType, year: e.target.value, month })}
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label>เดือน</label>
          <select
            value={month}
            onChange={(e) => onChange({ communityKey, yearType, year, month: e.target.value })}
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCommunity && (
        <div className="comm-title-row">
          <div className="comm-title-block">
            <h1>ชุมชน{selectedCommunity.community_key}</h1>
            <div className="comm-meta">
              <span>
                📍 ต.{selectedCommunity.subdistrict} อ.{selectedCommunity.district}{' '}
                <b>จ.{selectedCommunity.province}</b>
              </span>
              <span>
                👤 ผู้ดูแลพื้นที่: <b>{selectedCommunity.caretaker_current || 'ไม่ระบุ'}</b>
              </span>
              <span>
                👥 สมาชิก <b>{memberCount}</b> คน
              </span>
            </div>
          </div>
        </div>
      )}

      {kpis && (
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="kpi-label">รายได้สุทธิ — {periodLabel}</div>
            <div className="kpi-value">
              {formatBaht(kpis.netIncome)}
              <span className="unit">฿</span>
            </div>
            <DeltaLabel value={kpis.deltas.netIncome} />
          </div>
          <div className="kpi-card">
            <div className="kpi-label">ลดรายจ่ายครัวเรือน</div>
            <div className="kpi-value">
              {formatBaht(kpis.householdReduction)}
              <span className="unit">฿</span>
            </div>
            <DeltaLabel value={kpis.deltas.householdReduction} />
          </div>
          <div className="kpi-card">
            <div className="kpi-label">แบ่งปันในชุมชน</div>
            <div className="kpi-value">
              {formatBaht(kpis.sharing)}
              <span className="unit">฿</span>
            </div>
            <DeltaLabel value={kpis.deltas.sharing} />
          </div>
          <div className="kpi-card">
            <div className="kpi-label">เฉลี่ยต่อสมาชิก ({memberCount} คน)</div>
            <div className="kpi-value">
              {formatBaht(kpis.perMember)}
              <span className="unit">฿/ช่วง</span>
            </div>
            <div className="kpi-delta flat">รายบุคคลต่างกันมาก ดูแท็บรายสมาชิก</div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaLabel({ value }) {
  if (value === null) {
    return <div className="kpi-delta flat">ไม่มีข้อมูลช่วงก่อนเทียบ</div>;
  }
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '—';
  return (
    <div className={`kpi-delta ${direction}`}>
      {arrow} {Math.abs(value).toFixed(1)}% จากช่วงก่อน
    </div>
  );
}
