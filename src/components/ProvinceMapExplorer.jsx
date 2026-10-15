// src/components/ProvinceMapExplorer.jsx
//
// ห่อ ProvinceMap ให้สำรวจได้: สลับตัวชี้วัด (รายได้สุทธิ / ลดรายจ่ายครัวเรือน) และเลื่อนดูทีละเดือนด้วยแถบเวลา
// พร้อมปุ่มเล่นต่อเนื่อง เดือนที่เลือกเก็บใน URL (พารามิเตอร์ at เป็น ค.ศ.-เดือน เช่น 2026-03) ส่งลิงก์ให้คนอื่นเปิดตรงเดือนนั้นได้
import { useEffect, useMemo, useState } from 'react';
import ProvinceMap from './ProvinceMap';
import SegmentedControl from './ui/SegmentedControl';
import { aggregateByProvince } from '../pages/homepageAggregations';
import { formatMonthLabel } from '../pages/fiscalYears';
import './ProvinceMapExplorer.css';

const METRIC_OPTIONS = [
  { value: 'netIncome', label: 'รายได้สุทธิ' },
  { value: 'householdReduction', label: 'ลดรายจ่ายครัวเรือน' },
];
const METRIC_LABEL = { netIncome: 'รายได้สุทธิ', householdReduction: 'ลดรายจ่ายครัวเรือน' };
const PLAY_INTERVAL_MS = 1100;
const URL_PARAM = 'at';

function monthText(monthStr) {
  const [y] = monthStr.split('-').map(Number);
  return `${formatMonthLabel(monthStr)} ${y + 543}`;
}

function readMonthFromUrl() {
  try {
    const value = new URLSearchParams(window.location.search).get(URL_PARAM);
    return value && /^\d{4}-\d{2}$/.test(value) ? value : 'all';
  } catch {
    return 'all';
  }
}

function writeMonthToUrl(month) {
  try {
    const url = new URL(window.location.href);
    if (month === 'all') url.searchParams.delete(URL_PARAM);
    else url.searchParams.set(URL_PARAM, month);
    window.history.replaceState(null, '', url);
  } catch {
    // ถ้าเขียน URL ไม่ได้ (เช่นอยู่ในกรอบฝัง) ก็ข้ามไป แผนที่ยังทำงานปกติ
  }
}

/**
 * props:
 *   rows: monthly_summary ที่กรองปี/ภาคแล้ว (ยังไม่กรองจังหวัด/ชุมชน/เดือน)
 *   communities: รายการชุมชนทั้งหมด
 *   selectedProvince: จังหวัดที่กำลังกรองอยู่ หรือ 'all'
 *   onSelectProvince: (province) => void
 */
export default function ProvinceMapExplorer({ rows, communities, selectedProvince, onSelectProvince }) {
  const [metric, setMetric] = useState('netIncome');
  const [requestedMonth, setRequestedMonth] = useState(readMonthFromUrl);
  const [playing, setPlaying] = useState(false);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.month))).sort(), [rows]);

  // เดือนที่ขอมาจากลิงก์ แต่ไม่อยู่ในช่วงที่กำลังดู ให้ถือเป็น "ทั้งช่วง"
  const activeMonth = requestedMonth !== 'all' && months.includes(requestedMonth) ? requestedMonth : 'all';
  const sliderValue = activeMonth === 'all' ? 0 : months.indexOf(activeMonth) + 1;

  const totals = useMemo(() => {
    const scoped = activeMonth === 'all' ? rows : rows.filter((r) => r.month === activeMonth);
    return aggregateByProvince(scoped, communities);
  }, [rows, communities, activeMonth]);

  useEffect(() => {
    writeMonthToUrl(activeMonth);
  }, [activeMonth]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setRequestedMonth((prev) => {
        const idx = prev === 'all' ? -1 : months.indexOf(prev);
        if (idx + 1 >= months.length) {
          setPlaying(false);
          return prev;
        }
        return months[idx + 1];
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, months]);

  function handleSlider(event) {
    const v = Number(event.target.value);
    setPlaying(false);
    setRequestedMonth(v === 0 ? 'all' : months[v - 1]);
  }

  function handlePlayToggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    // เริ่มเล่นจากต้นช่วงเสมอ ถ้าเล่นจบแล้วหรือยังอยู่ที่ "ทั้งช่วง"
    if (activeMonth === 'all' || months.indexOf(activeMonth) === months.length - 1) {
      setRequestedMonth(months[0]);
    }
    setPlaying(true);
  }

  const hasMonths = months.length > 1;

  return (
    <div className="map-explorer">
      <div className="map-explorer__bar">
        <SegmentedControl ariaLabel="ตัวชี้วัดบนแผนที่" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
        <div className="map-explorer__now" aria-live="polite">
          {activeMonth === 'all' ? 'ทั้งช่วงที่เลือก' : `เดือน ${monthText(activeMonth)}`}
        </div>
      </div>

      <ProvinceMap
        provinceTotals={totals}
        onSelectProvince={onSelectProvince}
        valueKey={metric}
        valueLabel={METRIC_LABEL[metric]}
        selectedProvince={selectedProvince === 'all' ? null : selectedProvince}
      />

      {hasMonths && (
        <div className="map-explorer__scrubber">
          <button
            type="button"
            className="map-explorer__play"
            onClick={handlePlayToggle}
            aria-label={playing ? 'หยุดเล่น' : 'เล่นไล่ดูทีละเดือน'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <div className="map-explorer__track">
            <input
              type="range"
              min={0}
              max={months.length}
              step={1}
              value={sliderValue}
              onChange={handleSlider}
              aria-label="เลื่อนเลือกเดือนบนแผนที่"
              aria-valuetext={activeMonth === 'all' ? 'ทั้งช่วงที่เลือก' : monthText(activeMonth)}
            />
            <div className="map-explorer__ticks" aria-hidden="true">
              <span>ทั้งช่วง</span>
              <span>{monthText(months[0])}</span>
              <span>{monthText(months[months.length - 1])}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
