// src/components/FilterBar.jsx
import { buildFiscalYearDropdownOptions, buildCalendarYearDropdownOptions } from '../pages/fiscalYears';
import './FilterBar.css';

// สร้างจาก fiscalYears.js จุดเดียว — ไม่ต้องแก้ที่นี่เวลาขึ้นปีงบใหม่
const FISCAL_YEARS = buildFiscalYearDropdownOptions({ includeAll: true });
const CALENDAR_YEARS = buildCalendarYearDropdownOptions();

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

/**
 * แถบตัวกรองของหน้าแรก ควบคุมโดย parent component (ไม่มี state ภายในตัวเอง)
 * เพื่อให้ parent ตัดสินใจได้ว่าจะ refetch ข้อมูลตอนไหน
 *
 * props:
 *   yearType: 'fiscal' | 'calendar'
 *   year: string (ค่าตรงกับ FISCAL_YEARS หรือ CALENDAR_YEARS ตาม yearType)
 *   month: string ('all' หรือ '01'..'12')
 *   region: string ('all' หรือชื่อภาค)
 *   province: string ('all' หรือชื่อจังหวัด)
 *   community: string ('all' หรือ community_key)
 *   regions: string[] รายชื่อภาคทั้งหมด (สำหรับ dropdown)
 *   provinces: string[] รายชื่อจังหวัดทั้งหมด (สำหรับ dropdown)
 *   communities: { community_key, subdistrict, province, region }[] รายชื่อชุมชนทั้งหมด
 *   onChange: (nextFilterState) => void เรียกทุกครั้งที่ผู้ใช้เปลี่ยนค่าใด ๆ
 */
export default function FilterBar({
  yearType,
  year,
  month,
  region,
  province,
  community,
  regions,
  provinces,
  communities,
  onChange,
}) {
  const yearOptions = yearType === 'fiscal' ? FISCAL_YEARS : CALENDAR_YEARS;

  function update(partial) {
    onChange({ yearType, year, month, region, province, community, ...partial });
  }

  function handleYearTypeChange(nextType) {
    // สลับประเภทปีแล้วค่า "ปี" เดิมอาจไม่ตรงกับตัวเลือกใหม่ รีเซ็ตเป็นค่าแรกของชุดใหม่เสมอ
    const defaultYear = nextType === 'fiscal' ? FISCAL_YEARS[0].value : CALENDAR_YEARS[0].value;
    onChange({ yearType: nextType, year: defaultYear, month, region, province, community });
  }

  function handleReset() {
    onChange({
      yearType: 'fiscal',
      year: FISCAL_YEARS[0].value,
      month: 'all',
      region: 'all',
      province: 'all',
      community: 'all',
    });
  }

  // เลือกภาคแล้ว ตัวเลือกจังหวัดต้องกรองให้เหลือแค่จังหวัดในภาคนั้น และล้างจังหวัด/ชุมชน
  // เดิมทิ้ง เพราะอาจไม่ได้อยู่ในภาคใหม่ที่เลือก
  function handleRegionChange(nextRegion) {
    onChange({ yearType, year, month, region: nextRegion, province: 'all', community: 'all' });
  }

  const communitiesInRegion =
    region === 'all' ? communities : communities.filter((c) => c.region === region);
  const provincesInRegion = region === 'all' ? provinces : [...new Set(communitiesInRegion.map((c) => c.province))].sort();

  const communitiesInProvince =
    province === 'all'
      ? communitiesInRegion
      : communitiesInRegion.filter((c) => c.province === province);

  const hasActiveFilters =
    month !== 'all' || region !== 'all' || province !== 'all' || community !== 'all';

  return (
    <div className="filter-bar">
      <div className="filter-bar__row">
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
          <label>ปี</label>
          <select value={year} onChange={(e) => update({ year: e.target.value })}>
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>เดือน</label>
          <select value={month} onChange={(e) => update({ month: e.target.value })}>
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>ภาค</label>
          <select value={region} onChange={(e) => handleRegionChange(e.target.value)}>
            <option value="all">ทุกภาค ({regions.length})</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>จังหวัด</label>
          <select
            value={province}
            onChange={(e) => update({ province: e.target.value, community: 'all' })}
          >
            <option value="all">ทุกจังหวัด ({provincesInRegion.length})</option>
            {provincesInRegion.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>ชุมชน</label>
          <select value={community} onChange={(e) => update({ community: e.target.value })}>
            <option value="all">ทุกชุมชน ({communitiesInProvince.length})</option>
            {communitiesInProvince.map((c) => (
              <option key={c.community_key} value={c.community_key}>
                ชุมชน{c.community_key}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar__spacer" />

        {hasActiveFilters && (
          <button type="button" className="reset-link" onClick={handleReset}>
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="active-filter-row">
          <span className="active-filter-row__label">กำลังดู:</span>
          {month !== 'all' && (
            <span className="filter-chip">
              เดือน {MONTH_OPTIONS.find((m) => m.value === month)?.label}
              <button type="button" onClick={() => update({ month: 'all' })} aria-label="ล้างตัวกรองเดือน">
                ✕
              </button>
            </span>
          )}
          {region !== 'all' && (
            <span className="filter-chip">
              ภาค{region}
              <button
                type="button"
                onClick={() => handleRegionChange('all')}
                aria-label="ล้างตัวกรองภาค"
              >
                ✕
              </button>
            </span>
          )}
          {province !== 'all' && (
            <span className="filter-chip">
              {province}
              <button
                type="button"
                onClick={() => update({ province: 'all', community: 'all' })}
                aria-label="ล้างตัวกรองจังหวัด"
              >
                ✕
              </button>
            </span>
          )}
          {community !== 'all' && (
            <span className="filter-chip">
              ชุมชน{community}
              <button type="button" onClick={() => update({ community: 'all' })} aria-label="ล้างตัวกรองชุมชน">
                ✕
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
