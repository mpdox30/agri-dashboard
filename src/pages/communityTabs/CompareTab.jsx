// src/pages/communityTabs/CompareTab.jsx
//
// เทียบสองชุมชนเคียงกัน: เลือกชุมชนที่สองแล้วดูตัวเลขหลักเป็นแถบคู่ พร้อมกราฟเส้นรายเดือนซ้อนกัน
// ใช้ข้อมูล summary ที่ตัดเดือนซึ่งน่าจะไม่ได้กรอกจริงออกแล้ว (cleanedAllSummaryRows) เหมือนทุกแท็บ
import { useMemo, useState } from 'react';
import { enumerateMonths, formatMonthLabel } from '../fiscalYears';
import { sumRangeTotals, percentChange } from '../communityAggregations';
import useCrosshair from '../../components/charts/useCrosshair';
import SvgTooltip from '../../components/charts/SvgTooltip';
import DrawInPath from '../../components/charts/DrawInPath';
import DataTableToggle from '../../components/charts/DataTableToggle';
import '../../components/charts/charts.css';
import './CompareTab.css';

const W = 700;
const H = 210;
const PL = 46;
const PR = 14;
const PT = 14;
const PB = 26;
const CW = W - PL - PR;
const CH = H - PT - PB;

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

function monthlySeries(rows, range) {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return enumerateMonths(range.start, range.end).map((m) => {
    const r = byMonth.get(m);
    if (!r) return { month: m, label: formatMonthLabel(m), net: null };
    return { month: m, label: formatMonthLabel(m), net: (Number(r.sale) || 0) - (Number(r.purchase) || 0) + (Number(r.sharing) || 0) };
  });
}

function buildPath(points) {
  // เส้นขาดเมื่อเจอเดือนที่ไม่มีข้อมูล (ไม่ลากเส้นข้ามช่วงว่าง)
  let d = '';
  let pen = false;
  points.forEach((p) => {
    if (p.y === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

/**
 * props:
 *   communities, cleanedAllSummaryRows, communityKey (ชุมชนหลักที่กำลังดู)
 *   selectedRange, previousRange, periodLabel
 */
export default function CompareTab({ communities, cleanedAllSummaryRows, communityKey, selectedRange, previousRange, periodLabel }) {
  const me = communities.find((c) => c.community_key === communityKey) || null;

  const totalsByKey = useMemo(() => {
    const map = new Map();
    communities.forEach((c) => {
      const rows = cleanedAllSummaryRows.filter((r) => r.community_key === c.community_key);
      map.set(c.community_key, { rows, totals: sumRangeTotals(rows, selectedRange), prev: previousRange ? sumRangeTotals(rows, previousRange) : null });
    });
    return map;
  }, [communities, cleanedAllSummaryRows, selectedRange, previousRange]);

  // ตัวเลือกเริ่มต้น: ชุมชนในจังหวัดเดียวกันที่รายได้ใกล้เคียงที่สุด ถ้าไม่มีก็ชุมชนแรกที่มีข้อมูลในภาคเดียวกัน
  const defaultOther = useMemo(() => {
    const mine = totalsByKey.get(communityKey)?.totals?.netIncome ?? 0;
    const candidates = communities.filter((c) => c.community_key !== communityKey && (totalsByKey.get(c.community_key)?.totals?.monthsWithData ?? 0) > 0);
    const score = (c) => (c.province && me && c.province === me.province ? 0 : c.region && me && c.region === me.region ? 1 : 2);
    candidates.sort((a, b) => score(a) - score(b) || Math.abs(totalsByKey.get(a.community_key).totals.netIncome - mine) - Math.abs(totalsByKey.get(b.community_key).totals.netIncome - mine));
    return candidates[0]?.community_key || null;
  }, [communities, communityKey, me, totalsByKey]);

  const [pickedKey, setPickedKey] = useState(null);
  const otherKey = pickedKey && pickedKey !== communityKey && totalsByKey.has(pickedKey) ? pickedKey : defaultOther;
  const other = communities.find((c) => c.community_key === otherKey) || null;

  const a = totalsByKey.get(communityKey);
  const b = otherKey ? totalsByKey.get(otherKey) : null;

  const seriesA = useMemo(() => (a ? monthlySeries(a.rows, selectedRange) : []), [a, selectedRange]);
  const seriesB = useMemo(() => (b ? monthlySeries(b.rows, selectedRange) : []), [b, selectedRange]);

  const n = seriesA.length;
  const step = n > 1 ? CW / (n - 1) : 0;
  const xs = useMemo(() => seriesA.map((_, i) => PL + i * step), [seriesA, step]);
  const { active, bind } = useCrosshair(xs, W);

  const allVals = [...seriesA, ...seriesB].map((p) => p.net).filter((v) => v !== null);
  const maxV = Math.max(0, ...allVals);
  const minV = Math.min(0, ...allVals);
  const range = maxV - minV || 1;
  const yAt = (v) => PT + CH * (1 - (v - minV) / range);
  const toPoints = (series) => series.map((p, i) => ({ x: xs[i], y: p.net === null ? null : yAt(p.net) }));
  const pointsA = toPoints(seriesA);
  const pointsB = toPoints(seriesB);

  if (!me) return null;

  if (!other || !a?.totals || !b?.totals) {
    return (
      <div className="cmp-empty">
        ยังไม่มีชุมชนอื่นที่มีข้อมูลในช่วง {periodLabel} ให้เทียบ ลองเปลี่ยนช่วงเวลาด้านบน
      </div>
    );
  }

  const ta = a.totals;
  const tb = b.totals;
  const growthA = a.prev && a.prev.monthsWithData > 0 && ta.monthsWithData > 0 ? percentChange(ta.netIncome, a.prev.netIncome) : null;
  const growthB = b.prev && b.prev.monthsWithData > 0 && tb.monthsWithData > 0 ? percentChange(tb.netIncome, b.prev.netIncome) : null;

  const metrics = [
    { key: 'net', label: 'รายได้สุทธิ', va: ta.netIncome, vb: tb.netIncome, fmt: (v) => `${formatBaht(v)} ฿` },
    { key: 'sale', label: 'รายได้จากการขาย', va: ta.sale, vb: tb.sale, fmt: (v) => `${formatBaht(v)} ฿` },
    { key: 'sharing', label: 'แบ่งปันในชุมชน', va: ta.sharing, vb: tb.sharing, fmt: (v) => `${formatBaht(v)} ฿` },
    { key: 'household', label: 'ลดรายจ่ายครัวเรือน', va: ta.householdReduction, vb: tb.householdReduction, fmt: (v) => `${formatBaht(v)} ฿` },
    { key: 'purchase', label: 'ซื้อ (หักออก)', va: ta.purchase, vb: tb.purchase, fmt: (v) => `${formatBaht(v)} ฿`, lowerIsBetter: true },
    { key: 'months', label: 'เดือนที่มีข้อมูล', va: ta.monthsWithData, vb: tb.monthsWithData, fmt: (v) => `${v} เดือน` },
  ];
  if (growthA !== null && growthB !== null) {
    metrics.splice(1, 0, { key: 'growth', label: `เติบโตเทียบช่วงก่อน`, va: growthA, vb: growthB, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`, signed: true });
  }

  const nameA = `ชุมชน${me.community_key}`;
  const nameB = `ชุมชน${other.community_key}`;
  const cur = active !== null ? active : null;
  const tipLines =
    cur !== null
      ? [
          { label: me.community_key, value: seriesA[cur].net === null ? 'ไม่มีข้อมูล' : `${formatBaht(seriesA[cur].net)} ฿`, color: 'var(--green-soft)' },
          { label: other.community_key, value: seriesB[cur].net === null ? 'ไม่มีข้อมูล' : `${formatBaht(seriesB[cur].net)} ฿`, color: 'var(--blue)' },
        ]
      : null;
  const anchorY = cur !== null ? Math.min(...[seriesA[cur].net, seriesB[cur].net].filter((v) => v !== null).map(yAt), PT + CH) : PT;

  const others = communities
    .filter((c) => c.community_key !== communityKey)
    .sort((x, y) => x.community_key.localeCompare(y.community_key, 'th'));

  return (
    <div className="cmp">
      <div className="cmp-pick stat-row-card cmp-card">
        <div className="cmp-pick__vs">
          <span className="cmp-chip cmp-chip--a"><i />{nameA}</span>
          <span className="cmp-vs">เทียบกับ</span>
          <span className="cmp-chip cmp-chip--b"><i />{nameB}</span>
        </div>
        <label className="cmp-select">
          <span>เลือกชุมชนที่จะเทียบ</span>
          <select value={otherKey} onChange={(e) => setPickedKey(e.target.value)}>
            {others.map((c) => (
              <option key={c.community_key} value={c.community_key}>
                {c.community_key}{c.province ? ` (${c.province})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cmp-grid">
        <div className="stat-row-card cmp-card">
          <div className="card-title">ตัวเลขเทียบกัน · {periodLabel}</div>
          <div className="cmp-rows">
            {metrics.map((m, i) => {
              const max = Math.max(Math.abs(m.va), Math.abs(m.vb), 1);
              const better = m.va === m.vb ? null : (m.lowerIsBetter ? m.va < m.vb : m.va > m.vb) ? 'a' : 'b';
              return (
                <div className="cmp-row" key={m.key} style={{ '--rn': i }}>
                  <div className="cmp-row__label">{m.label}</div>
                  <div className={`cmp-line cmp-line--a${better === 'a' ? ' is-better' : ''}`}>
                    <span className="cmp-track"><i className={`cmp-fill cmp-fill--a${m.signed && m.va < 0 ? ' is-neg' : ''}`} style={{ width: `${(Math.abs(m.va) / max) * 100}%` }} /></span>
                    <b>{m.fmt(m.va)}</b>
                  </div>
                  <div className={`cmp-line cmp-line--b${better === 'b' ? ' is-better' : ''}`}>
                    <span className="cmp-track"><i className={`cmp-fill cmp-fill--b${m.signed && m.vb < 0 ? ' is-neg' : ''}`} style={{ width: `${(Math.abs(m.vb) / max) * 100}%` }} /></span>
                    <b>{m.fmt(m.vb)}</b>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="cmp-note">แถบที่เด่นกว่าคือฝั่งที่ค่าดีกว่าในแต่ละหัวข้อ (ซื้อ: ยิ่งน้อยยิ่งดี) ชุมชนต่างขนาดกันได้ จึงควรอ่านร่วมกับจำนวนสมาชิกและพื้นที่</p>
        </div>

        <div className="stat-row-card cmp-card chart-section-card">
          <div className="card-title">รายได้สุทธิรายเดือน ซ้อนกัน</div>
          <div className="cmp-legend">
            <span className="cmp-chip cmp-chip--a"><i />{me.community_key}</span>
            <span className="cmp-chip cmp-chip--b"><i />{other.community_key}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="cmp-chart" role="img" aria-label={`รายได้สุทธิรายเดือน ${nameA} เทียบ ${nameB}`} {...bind}>
            {[minV, minV + range / 2, maxV].map((t) => (
              <g key={t} className="cmp-grid-line">
                <line x1={PL} x2={W - PR} y1={yAt(t)} y2={yAt(t)} />
                <text x={PL - 6} y={yAt(t) + 3} textAnchor="end">{formatShort(t)}</text>
              </g>
            ))}
            {seriesA.map((p, i) => (n <= 12 || i % 2 === 0) && (
              <text key={p.month} x={xs[i]} y={H - 8} textAnchor="middle" className="cmp-month">{p.label}</text>
            ))}
            <DrawInPath d={buildPath(pointsA)} stroke="var(--green-soft)" strokeWidth={2.6} duration={1300} />
            <DrawInPath d={buildPath(pointsB)} stroke="var(--blue)" strokeWidth={2.6} duration={1300} delay={150} />
            {cur !== null && (
              <g pointerEvents="none">
                <line x1={xs[cur]} x2={xs[cur]} y1={PT} y2={PT + CH} className="cmp-cursor" />
                {pointsA[cur].y !== null && <circle cx={xs[cur]} cy={pointsA[cur].y} r="4.5" fill="var(--green-soft)" className="cmp-dot" />}
                {pointsB[cur].y !== null && <circle cx={xs[cur]} cy={pointsB[cur].y} r="4.5" fill="var(--blue)" className="cmp-dot" />}
                <SvgTooltip x={xs[cur]} y={anchorY} title={seriesA[cur].label} lines={tipLines} viewBoxWidth={W} top={0} />
              </g>
            )}
          </svg>
          <DataTableToggle
            summary="ดูค่าเป็นตาราง"
            caption={`รายได้สุทธิรายเดือนของ ${nameA} และ ${nameB}`}
            columns={[
              { key: 'month', label: 'เดือน' },
              { key: 'a', label: `${me.community_key} (บาท)`, align: 'right' },
              { key: 'b', label: `${other.community_key} (บาท)`, align: 'right' },
            ]}
            rows={seriesA.map((p, i) => ({
              key: p.month,
              month: p.label,
              a: p.net === null ? 'ไม่มีข้อมูล' : formatBaht(p.net),
              b: seriesB[i].net === null ? 'ไม่มีข้อมูล' : formatBaht(seriesB[i].net),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
