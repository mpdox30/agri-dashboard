// src/components/CommunityExportPanel.jsx
import { useState } from 'react';
import { buildFiscalYearDropdownOptions } from '../pages/fiscalYears';
import './CommunityExportPanel.css';

const YEAR_OPTIONS = buildFiscalYearDropdownOptions(); // เรียงใหม่ -> เก่า

/**
 * กล่องเลือกดาวน์โหลดข้อมูลรายชุมชน — แยกอิสระจากตัวเลือกชุมชน/ปีที่กำลังดูอยู่บน
 * หน้าจอหลัก ตั้งใจให้เลือกชุมชน/ปีอื่นเพื่อดาวน์โหลดได้โดยไม่ต้องเปลี่ยนสิ่งที่ดูอยู่
 *
 * props:
 *   communities: รายชื่อชุมชนทั้งหมด (สำหรับ dropdown)
 *   defaultCommunityKey: ค่าเริ่มต้นของช่องเลือกชุมชน (ปกติคือชุมชนที่กำลังดูอยู่)
 *   onExport: (communityKey, yearKeys[]) => void เรียกตอนกดยืนยันดาวน์โหลด
 *   isExporting: boolean แสดงสถานะกำลังสร้างไฟล์ (ปิดปุ่มไว้กันกดซ้ำ)
 */
export default function CommunityExportPanel({ communities, defaultCommunityKey, onExport, isExporting }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportCommunityKey, setExportCommunityKey] = useState(defaultCommunityKey || '');
  const [selectedYears, setSelectedYears] = useState(() => new Set(YEAR_OPTIONS.map((y) => y.value)));
  const [regionFilter, setRegionFilter] = useState('all');

  const regions = [...new Set(communities.map((c) => c.region).filter(Boolean))].sort();
  const communitiesInRegion =
    regionFilter === 'all' ? communities : communities.filter((c) => c.region === regionFilter);

  // ทุกครั้งที่เปิดกล่องนี้ใหม่ ให้ค่าเริ่มต้นตรงกับชุมชนที่กำลังดูอยู่บนหน้าจอหลักเสมอ
  // (เผื่อผู้ใช้สลับชุมชนบนหน้าจอหลักไปแล้วระหว่างที่กล่องนี้ปิดอยู่) แต่หลังเปิดแล้ว
  // ผู้ใช้เปลี่ยนในกล่องนี้เองได้อิสระ ไม่กระทบหน้าจอหลัก
  function handleOpen() {
    setExportCommunityKey(defaultCommunityKey || '');
    setRegionFilter('all');
    setIsOpen(true);
  }

  function handleRegionFilterChange(nextRegion) {
    setRegionFilter(nextRegion);
    const stillValid = nextRegion === 'all' || communities.find((c) => c.community_key === exportCommunityKey)?.region === nextRegion;
    if (!stillValid) {
      const inRegion = communities.filter((c) => c.region === nextRegion);
      if (inRegion.length > 0) setExportCommunityKey(inRegion[0].community_key);
    }
  }

  function toggleYear(value) {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleSelectAllYears() {
    setSelectedYears(new Set(YEAR_OPTIONS.map((y) => y.value)));
  }

  function handleClearYears() {
    setSelectedYears(new Set());
  }

  function handleConfirm() {
    if (!exportCommunityKey || selectedYears.size === 0) return;
    onExport(exportCommunityKey, Array.from(selectedYears));
  }

  if (!isOpen) {
    return (
      <button type="button" className="cep-trigger-btn" onClick={handleOpen}>
        ⬇ ดาวน์โหลดข้อมูลรายชุมชน
      </button>
    );
  }

  return (
    <div className="cep-panel">
      <div className="cep-panel__head">
        <span>ดาวน์โหลดข้อมูลรายชุมชน</span>
        <button type="button" className="cep-close-btn" onClick={() => setIsOpen(false)} aria-label="ปิด">
          ✕
        </button>
      </div>
      <p className="cep-note">เลือกชุมชนและปีที่ต้องการได้อิสระ ไม่ต้องตรงกับที่กำลังดูอยู่</p>

      <div className="cep-field">
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

      <div className="cep-field">
        <label>ชุมชน</label>
        <select value={exportCommunityKey} onChange={(e) => setExportCommunityKey(e.target.value)}>
          {communitiesInRegion.map((c) => (
            <option key={c.community_key} value={c.community_key}>
              ชุมชน{c.community_key} ({c.province})
            </option>
          ))}
        </select>
      </div>

      <div className="cep-field">
        <div className="cep-field__head">
          <label>ปีงบประมาณ</label>
          <div className="cep-year-actions">
            <button type="button" onClick={handleSelectAllYears}>
              เลือกทั้งหมด
            </button>
            <button type="button" onClick={handleClearYears}>
              ล้าง
            </button>
          </div>
        </div>
        <div className="cep-year-checkboxes">
          {YEAR_OPTIONS.map((y) => (
            <label key={y.value} className="cep-year-checkbox">
              <input
                type="checkbox"
                checked={selectedYears.has(y.value)}
                onChange={() => toggleYear(y.value)}
              />
              {y.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="cep-confirm-btn"
        onClick={handleConfirm}
        disabled={!exportCommunityKey || selectedYears.size === 0 || isExporting}
      >
        {isExporting ? 'กำลังสร้างไฟล์...' : '⬇ ดาวน์โหลด (.xlsx)'}
      </button>
    </div>
  );
}
