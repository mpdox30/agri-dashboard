// src/components/LiveHeadline.jsx
//
// ประโยคหัวเรื่องที่ตัวเลขในประโยคเปลี่ยนตามตัวกรองที่เลือก (แทนหัวข้อคงที่) พร้อมป้ายบอกเดือนล่าสุดของข้อมูล
// น้ำเสียงเป็นกลาง บอกสิ่งที่เห็นในข้อมูล ไม่ตัดสินว่าดีหรือแย่
import CountUp from './ui/CountUp';
import { formatMonthLabel } from '../pages/fiscalYears';
import './LiveHeadline.css';

function formatInteger(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

function formatLatestMonth(monthStr) {
  const [y] = monthStr.split('-').map(Number);
  return `${formatMonthLabel(monthStr)} ${y + 543}`;
}

/**
 * props:
 *   scopeLabel: ช่วง/ขอบเขตที่กำลังดู เช่น "ปีงบ 68–69"
 *   communitiesWithData, totalCommunities, netIncome: ตัวเลขจากช่วงที่เลือก
 *   latestMonth: "YYYY-MM" ของข้อมูลล่าสุดทั้งระบบ หรือ null
 */
export default function LiveHeadline({ scopeLabel, communitiesWithData, totalCommunities, netIncome, latestMonth }) {
  const hasData = communitiesWithData > 0;
  return (
    <div className="live-headline" aria-live="polite">
      <p className="live-headline__sentence">
        {hasData ? (
          <>
            {scopeLabel} มี <strong><CountUp value={communitiesWithData} format={formatInteger} /></strong> จาก{' '}
            {formatInteger(totalCommunities)} ชุมชนที่ส่งข้อมูลแล้ว รวมรายได้สุทธิ{' '}
            <strong><CountUp value={netIncome} format={formatInteger} /></strong> บาท
          </>
        ) : (
          <>{scopeLabel} ยังไม่มีชุมชนที่ส่งข้อมูลในขอบเขตที่เลือก ลองปรับตัวกรองด้านล่างดูได้ครับ</>
        )}
      </p>
      {latestMonth && (
        <span className="live-headline__badge">ข้อมูลล่าสุด: {formatLatestMonth(latestMonth)}</span>
      )}
    </div>
  );
}
