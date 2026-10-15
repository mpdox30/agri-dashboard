// src/components/ProvinceGrid.jsx
import Sparkline from './ui/Sparkline';
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
  return (
    <div className="province-grid">
      {provinceTotals.map((p) => (
        <button
          key={p.province}
          type="button"
          className="province-card"
          onClick={() => onSelectProvince(p.province)}
        >
          <div className="province-card__name">{p.province}</div>
          <div className="province-card__value">{formatMillionBaht(p.netIncome)} ล้านบาท</div>
          <div className="province-card__count">{p.communityCount} ชุมชน</div>
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
      ))}
    </div>
  );
}
