// src/components/HomeHero.jsx
//
// ส่วนหัวของหน้าแรก: ชื่อโครงการตัวใหญ่ ตัวเลขเด่น (รายได้สุทธิรวม + วงแหวนสัดส่วนชุมชนที่ส่งข้อมูล)
// และกราฟชีพจรรายเดือนที่ชี้ดูค่าได้ ฉากหลังเป็นเส้นชั้นนาขั้นบันไดที่ไหลช้าๆ
// ทั้งหมดอ่านค่าจากตัวกรองที่เลือกอยู่ จึงเปลี่ยนตามเมื่อผู้ใช้ปรับตัวกรองด้านล่าง
import { useMemo } from 'react';
import CountUp from './ui/CountUp';
import DeltaBadge from './ui/DeltaBadge';
import useCrosshair from './charts/useCrosshair';
import SvgTooltip from './charts/SvgTooltip';
import DrawInPath from './charts/DrawInPath';
import AreaFill from './charts/AreaFill';
import FlowLine from './charts/FlowLine';
import PulseRing from './charts/PulseRing';
import LiveGroup from './charts/LiveGroup';
import { formatMonthLabel } from '../pages/fiscalYears';
import './HomeHero.css';

const W = 440;
const H = 230;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 34;
const PAD_B = 34;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function formatMillion(n) {
  return (n / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
}
function formatLatest(monthStr) {
  const [y] = monthStr.split('-').map(Number);
  return `${formatMonthLabel(monthStr)} ${y + 543}`;
}

// เส้นโค้งนุ่มผ่านจุดทุกจุด (Catmull-Rom) สุ่มเป็นจุดถี่ๆ เพื่อใช้ทั้งวาดเส้นและพื้นที่ไล่สีชุดเดียวกัน
function smooth(points, steps = 10) {
  if (points.length < 3) return points;
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// ชั้นเนินนาขั้นบันได: คลื่นไซน์ซ้ำตามแนวนอน สร้างครั้งเดียวตอนโหลดโมดูล
function terracePath(baseY, amp, period, periods) {
  const half = period / 2;
  let d = `M0 ${baseY} Q${half / 2} ${baseY - amp} ${half} ${baseY}`;
  for (let i = 1; i < periods * 2; i += 1) d += ` T${half * (i + 1)} ${baseY}`;
  return `${d} V160 H0 Z`;
}
const TERRACES = [
  { y: 52, amp: 16, period: 520, speed: 62, fill: 0.12, rgb: '46, 127, 184', key: 'a' },
  { y: 78, amp: 20, period: 640, speed: 48, fill: 0.14, rgb: '46, 127, 184', key: 'b' },
  { y: 104, amp: 18, period: 480, speed: 36, fill: 0.2, rgb: '23, 128, 111', key: 'c' },
  { y: 130, amp: 22, period: 560, speed: 28, fill: 0.24, rgb: '11, 79, 74', key: 'd' },
];

/**
 * props:
 *   yearLabel: เช่น "ปีงบ 68-69"
 *   communityCount: จำนวนชุมชนทั้งหมดในระบบ
 *   totals: { netIncome, communitiesWithData, totalCommunities }
 *   netDelta: % เทียบเดือนเดียวกันของปีก่อน หรือ null
 *   series: { key, label, netIncome | null }[] รายเดือนของช่วงที่เลือก
 *   latestMonth: "YYYY-MM" ล่าสุดของข้อมูลทั้งระบบ หรือ null
 */
export default function HomeHero({ yearLabel, communityCount, totals, netDelta, series, latestMonth }) {
  const hasData = totals.communitiesWithData > 0;
  const coverage = totals.totalCommunities > 0 ? totals.communitiesWithData / totals.totalCommunities : 0;

  const geo = useMemo(() => {
    const known = series.map((m) => (m.netIncome === null ? null : m.netIncome));
    const vals = known.filter((v) => v !== null);
    const max = Math.max(1, ...vals);
    const min = Math.min(0, ...vals);
    const range = max - min || 1;
    const step = series.length > 1 ? PLOT_W / (series.length - 1) : 0;
    const points = series.map((m, i) => ({
      i,
      x: PAD_L + i * step,
      y: PAD_T + PLOT_H * (1 - ((known[i] ?? min) - min) / range),
      has: known[i] !== null,
      value: known[i],
      label: m.label,
    }));
    // แยกเป็นช่วงต่อเนื่อง (ตัดที่เดือนไม่มีข้อมูล) แล้วทำให้เส้นโค้งนุ่ม
    const segments = [];
    points.forEach((p) => {
      if (!p.has) {
        if (segments.length) segments[segments.length - 1].open = false;
        return;
      }
      const last = segments[segments.length - 1];
      if (last && last.open) last.raw.push(p);
      else segments.push({ raw: [p], open: true });
    });
    segments.forEach((s) => {
      s.dense = smooth(s.raw);
      s.d = s.dense.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    });
    const dataPoints = points.filter((p) => p.has);
    const peak = dataPoints.length ? dataPoints.reduce((a, b) => (b.value > a.value ? b : a)) : null;
    const lastP = dataPoints.length ? dataPoints[dataPoints.length - 1] : null;
    return { points, segments, peak, last: lastP, baseY: PAD_T + PLOT_H };
  }, [series]);

  const xs = geo.points.map((p) => p.x);
  const { active, bind } = useCrosshair(xs, W);
  const activePoint = active !== null ? geo.points[active] : null;

  const ariaLabel = geo.peak
    ? `กราฟรายได้สุทธิรายเดือน สูงสุดเดือน${geo.peak.label} ${formatInteger(geo.peak.value)} บาท ล่าสุดเดือน${geo.last.label} ${formatInteger(geo.last.value)} บาท`
    : 'กราฟรายได้สุทธิรายเดือน ยังไม่มีข้อมูล';

  return (
    <section className="hhero" aria-labelledby="hhero-title">
      <div className="hhero__bg" aria-hidden="true">
        <svg viewBox="0 0 520 160" preserveAspectRatio="none">
          {TERRACES.map((t) => (
            <g key={t.key} className="hhero__terrace" style={{ '--speed': `${t.speed}s`, '--shift': `${t.period}px` }}>
              <path d={terracePath(t.y, t.amp, t.period, 6)} fill={`rgba(${t.rgb}, ${t.fill})`} />
            </g>
          ))}
        </svg>
      </div>

      <div className="hhero__copy">
        {latestMonth && (
          <span className="hhero__eyebrow">
            <i className="hhero__live" aria-hidden="true" />
            ข้อมูลล่าสุด {formatLatest(latestMonth)}
          </span>
        )}
        <h1 id="hhero-title">ภาพรวมโครงการ</h1>
        <p className="hhero__sub">
          รวบรวมจาก {communityCount} ชุมชน/กลุ่ม ครอบคลุมข้อมูลตั้งแต่ปีงบประมาณ 2565 ถึง 2569 ตามแนวทางเกษตรทฤษฎีใหม่
        </p>

        {hasData ? (
          <div className="hhero__stats" aria-live="polite">
            <div className="hhero__stat hhero__stat--main">
              <div className="hhero__stat-label">รายได้สุทธิรวม · {yearLabel}</div>
              <div className="hhero__big">
                <CountUp value={totals.netIncome} format={formatMillion} duration={1400} />
                <span className="hhero__unit">ล้านบาท</span>
              </div>
              {netDelta !== null && (
                <div className="hhero__delta">
                  <DeltaBadge value={netDelta} suffix="จากเดือนเดียวกันของปีก่อน" />
                </div>
              )}
            </div>

            <div className="hhero__stat hhero__ring-wrap">
              <svg className="hhero__ring" viewBox="0 0 80 80" role="img" aria-label={`ส่งข้อมูลแล้ว ${Math.round(coverage * 100)}% ของชุมชนทั้งหมด`}>
                <circle className="hhero__ring-track" cx="40" cy="40" r="32" />
                <circle className="hhero__ring-fill" cx="40" cy="40" r="32" style={{ '--p': coverage }} />
                <text x="40" y="45" textAnchor="middle" className="hhero__ring-text">
                  {Math.round(coverage * 100)}%
                </text>
              </svg>
              <div>
                <div className="hhero__ring-num">
                  <CountUp value={totals.communitiesWithData} format={formatInteger} /> / {formatInteger(totals.totalCommunities)}
                </div>
                <div className="hhero__stat-label">ชุมชนที่ส่งข้อมูลแล้ว</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="hhero__empty">
            {yearLabel} ยังไม่มีชุมชนที่ส่งข้อมูลในขอบเขตที่เลือก ลองปรับตัวกรองด้านล่างดูได้ครับ
          </p>
        )}
      </div>

      <div className="hhero__visual">
        <div className="hhero__panel">
          <div className="hhero__panel-head">
            <span>รายได้สุทธิรายเดือน</span>
            <span className="hhero__panel-note">บาท · ชี้เพื่อดูค่า</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="hhero__chart chart-focus-ring" role="img" aria-label={ariaLabel} {...bind}>
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H * f} y2={PAD_T + PLOT_H * f} className="hhero__grid" />
            ))}
            {geo.segments.map((seg, si) => (
              <g key={si}>
                <AreaFill points={seg.dense} baselineY={geo.baseY} color="var(--green-soft)" delay={500} />
                <DrawInPath d={seg.d} className="hhero__line" duration={1500} />
                {seg.dense.length > 2 && <FlowLine d={seg.d} delay={1600} />}
              </g>
            ))}
            <LiveGroup>
              {geo.points
                .filter((p) => p.has)
                .map((p) => (
                  <circle
                    key={p.i}
                    cx={p.x}
                    cy={p.y}
                    r={active === p.i ? 5.5 : 3.6}
                    className={geo.peak && p.i === geo.peak.i ? 'hhero__dot hhero__dot--peak' : 'hhero__dot'}
                    style={{ '--i': p.i }}
                  />
                ))}
            </LiveGroup>
            {geo.peak && <PulseRing cx={geo.peak.x} cy={geo.peak.y} color="var(--terracotta)" />}
            {geo.last && geo.last !== geo.peak && <PulseRing cx={geo.last.x} cy={geo.last.y} color="var(--green-soft)" delay={1900} />}
            {geo.peak && active === null && (
              <text x={geo.peak.x} y={Math.max(geo.peak.y - 12, 12)} textAnchor="middle" className="hhero__peak-label">
                สูงสุด {formatInteger(geo.peak.value)}
              </text>
            )}
            {geo.points.map((p) =>
              p.i % 2 === 0 ? (
                <text key={p.i} x={p.x} y={H - 10} textAnchor="middle" className="hhero__month">
                  {p.label}
                </text>
              ) : null,
            )}
            {activePoint && (
              <>
                <line x1={activePoint.x} x2={activePoint.x} y1={PAD_T - 8} y2={geo.baseY} className="chart-crosshair-line" />
                <SvgTooltip
                  x={activePoint.x}
                  y={activePoint.y}
                  title={activePoint.label}
                  lines={[{ label: 'รายได้สุทธิ', value: activePoint.has ? `${formatInteger(activePoint.value)} บาท` : 'ยังไม่มีข้อมูล', color: 'var(--green-soft)' }]}
                  viewBoxWidth={W}
                />
              </>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
}
