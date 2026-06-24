// src/components/KpiRow.jsx
import './KpiRow.css';

function formatBaht(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function formatMillionBaht(n) {
  return (n / 1_000_000).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

/**
 * props:
 *   currentTotals: { netIncome, householdReduction, communitiesWithData, totalCommunities }
 *   previousTotals: same shape, สำหรับช่วงเทียบ (ปีก่อน/เดือนก่อน) หรือ null ถ้าไม่มีข้อมูลเทียบ
 *   dataQualityFlagCount: number
 */
export default function KpiRow({ currentTotals, previousTotals, dataQualityFlagCount }) {
  const netDelta = previousTotals
    ? ((currentTotals.netIncome - previousTotals.netIncome) / previousTotals.netIncome) * 100
    : null;
  const householdDelta = previousTotals
    ? ((currentTotals.householdReduction - previousTotals.householdReduction) /
        previousTotals.householdReduction) *
      100
    : null;

  return (
    <div className="kpi-row">
      <div className="kpi-card">
        <div className="kpi-label">รายได้สุทธิรวม</div>
        <div className="kpi-value">
          {formatMillionBaht(currentTotals.netIncome)}
          <span className="unit">ล้านบาท</span>
        </div>
        {netDelta !== null && <DeltaLabel value={netDelta} suffix="จากช่วงก่อน" />}
      </div>

      <div className="kpi-card">
        <div className="kpi-label">ลดรายจ่ายครัวเรือนรวม</div>
        <div className="kpi-value">
          {formatMillionBaht(currentTotals.householdReduction)}
          <span className="unit">ล้านบาท</span>
        </div>
        {householdDelta !== null && <DeltaLabel value={householdDelta} suffix="จากช่วงก่อน" />}
      </div>

      <div className="kpi-card">
        <div className="kpi-label">ชุมชนที่มีข้อมูลในช่วงที่เลือก</div>
        <div className="kpi-value">
          {currentTotals.communitiesWithData}
          <span className="unit">/ {currentTotals.totalCommunities} ชุมชน</span>
        </div>
        <div className="kpi-delta flat">
          {currentTotals.totalCommunities - currentTotals.communitiesWithData} ชุมชนยังไม่มีข้อมูลในช่วงนี้
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">
          คุณภาพข้อมูล
          {dataQualityFlagCount > 0 && (
            <span className="data-flag" title={`มี ${dataQualityFlagCount} ชุมชนที่มีประเด็นตรวจสอบในช่วงนี้`}>
              ⚑ {dataQualityFlagCount}
            </span>
          )}
        </div>
        <div className="kpi-value">
          {currentTotals.communitiesWithData > 0
            ? formatBaht(
                ((currentTotals.communitiesWithData - dataQualityFlagCount) /
                  currentTotals.communitiesWithData) *
                  100
              )
            : '—'}
          <span className="unit">% ไม่มีประเด็นต้องตรวจสอบ</span>
        </div>
      </div>
    </div>
  );
}

function DeltaLabel({ value, suffix }) {
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '—';
  return (
    <div className={`kpi-delta ${direction}`}>
      {arrow} {Math.abs(value).toFixed(1)}% {suffix}
    </div>
  );
}
