// src/components/ProvinceGrid.jsx
import Sparkline from './ui/Sparkline';
import Reveal from './ui/Reveal';
import './ProvinceGrid.css';

function formatMillionBaht(n) {
  return (n / 1_000_000).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

/**
 * props:
 *   provinceTotals: { province: string, netIncome: number, communityCount: number, series?: (number|null)[] }[]
 *     เรียงจากมากไปน้อยแล้วโดย parent
 *   onSelectProvince: (province: string) => void เรียกเมื่อคลิกการ์ด (ต่อกับ FilterBar)
 */
export default function ProvinceGrid({ provinceTotals, onSelectProvince }) {
  const top = Math.max(1, ...provinceTotals.map((p) => Math.max(p.netIncome, 0)));
  return (
    <div className="province-grid">
      {provinceTotals.map((p, i) => (
        <Reveal key={p.province} delay={Math.min(i, 8) * 45} className="province-card-wrap">
        <button
          type="button"
          className={i < 3 ? 'province-card province-card--top' : 'province-card'}
          onClick={() => onSelectProvince(p.province)}
        >
          <div className="province-card__head">
            <span className="province-card__rank" aria-label={`อันดับ ${i + 1}`}>{i + 1}</span>
            <span className="province-card__name">{p.province}</span>
          </div>
          <div className="province-card__value">{formatMillionBaht(p.netIncome)} ล้านบาท</div>
          <div className="province-card__bar" aria-hidden="true">
            <span style={{ width: `${Math.max((Math.max(p.netIncome, 0) / top) * 100, 2)}%` }} />
          </div>
          <div className="province-card__count">{p.communityCount} ชุมชน · {top > 0 ? Math.round((Math.max(p.netIncome, 0) / top) * 100) : 0}% ของจังหวัดสูงสุด</div>
          {p.series && p.series.filter((v) => v !== null).length >= 3 && (
            <Sparkline
              className="province-card__spark"
              values={p.series}
              width={120}
              height={26}
              label={`แนวโน้มรายได้สุทธิรายเดือนของ${p.province}`}
            />
          )}
        </button>
        </Reveal>
      ))}
    </div>
  );
}
