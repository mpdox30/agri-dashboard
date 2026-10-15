// src/components/KpiRow.jsx
import StatCard from './ui/StatCard';
import './KpiRow.css';

// หน่วยล้านบาท ทศนิยม 2 ตำแหน่ง (คงรูปแบบเดิมของการ์ด KPI) ตัวเลขจะนับขึ้นจาก 0 ตอนเลื่อนมาเห็น
function formatMillionBaht(n) {
  return (n / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function percentChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * props:
 *   currentTotals: { netIncome, householdReduction, communitiesWithData, totalCommunities }
 *   previousTotals: same shape, สำหรับช่วงเทียบ (ปีก่อน/เดือนก่อน) หรือ null ถ้าไม่มีข้อมูลเทียบ
 *   dataQualityFlagCount: number
 */
export default function KpiRow({ currentTotals, previousTotals, dataQualityFlagCount }) {
  const netDelta = previousTotals ? percentChange(currentTotals.netIncome, previousTotals.netIncome) : null;
  const householdDelta = previousTotals
    ? percentChange(currentTotals.householdReduction, previousTotals.householdReduction)
    : null;
  const missing = currentTotals.totalCommunities - currentTotals.communitiesWithData;
  const cleanPercent =
    currentTotals.communitiesWithData > 0
      ? ((currentTotals.communitiesWithData - dataQualityFlagCount) / currentTotals.communitiesWithData) * 100
      : null;

  return (
    <div className="kpi-row">
      <StatCard
        label="รายได้สุทธิรวม"
        value={currentTotals.netIncome}
        format={formatMillionBaht}
        unit="ล้านบาท"
        delta={netDelta}
        deltaSuffix="จากช่วงก่อน"
        delay={0}
      />
      <StatCard
        label="ลดรายจ่ายครัวเรือนรวม"
        value={currentTotals.householdReduction}
        format={formatMillionBaht}
        unit="ล้านบาท"
        delta={householdDelta}
        deltaSuffix="จากช่วงก่อน"
        delay={80}
      />
      <StatCard
        label="ชุมชนที่มีข้อมูลในช่วงที่เลือก"
        value={currentTotals.communitiesWithData}
        format={formatInteger}
        unit={`/ ${currentTotals.totalCommunities} ชุมชน`}
        note={missing > 0 ? `${missing} ชุมชนยังไม่มีข้อมูลในช่วงนี้` : 'ทุกชุมชนมีข้อมูลในช่วงนี้'}
        delay={160}
      />
      <StatCard
        label={
          <>
            คุณภาพข้อมูล
            {dataQualityFlagCount > 0 && (
              <span className="data-flag" title={`มี ${dataQualityFlagCount} ชุมชนที่มีประเด็นตรวจสอบในช่วงนี้`}>
                ⚑ {dataQualityFlagCount}
              </span>
            )}
          </>
        }
        value={cleanPercent}
        format={formatInteger}
        unit="% ไม่มีประเด็นต้องตรวจสอบ"
        delay={240}
      />
    </div>
  );
}
