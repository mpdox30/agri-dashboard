// src/pages/digestData.js
//
// สร้าง "สัญญาณจากข้อมูล" ด้วยกฎตายตัวและข้อความแม่แบบ (ไม่ใช้ LLM) เพื่อให้ผู้บริหารเห็นสิ่งที่ควรดูก่อนโดยไม่ต้องไล่อ่านทั้งหน้า
// น้ำเสียงเป็นกลาง บอกสิ่งที่เห็นในข้อมูล ไม่ตัดสินว่าใครทำดีหรือไม่ดี และเตือนว่ารายได้เกษตรผันผวนตามฤดูกาลเป็นปกติ

/** เปลี่ยนแปลงอย่างน้อยเท่านี้ (เป็น %) จึงถือว่าน่าสังเกต */
export const NOTABLE_CHANGE_PCT = 20;
/** ต้องมีเดือนที่เทียบได้อย่างน้อยเท่านี้ ไม่งั้นตัวเลขแกว่งเกินไปจนสรุปไม่ได้ */
export const MIN_PAIRED_MONTHS = 3;
/** ชุมชนที่ข้อมูลล่าสุดห่างจากเดือนล่าสุดของระบบตั้งแต่เท่านี้ (เดือน) ถือว่าเงียบไป */
export const STALE_MONTHS = 2;
/** จังหวัดเดียวมีสัดส่วนรายได้สุทธิตั้งแต่เท่านี้ (%) จึงนับว่ากระจุกตัว */
export const CONCENTRATION_PCT = 40;

function monthIndex(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return y * 12 + m;
}

function fmtPct(n) {
  return Math.abs(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function fmtInt(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}

/**
 * ข้อมูลเข้า:
 *   comparison: ผลจาก buildYearOverYearComparison (มี communities: { key, pct, pairedMonths }[]) หรือ null
 *   communitiesInScope: { community_key, province }[] ชุมชนในขอบเขตที่เลือก
 *   cleanedRows: monthly_summary ที่ผ่าน cleanAllSummaryRows แล้ว (ทุกชุมชน)
 *   latestMonth: เดือนล่าสุดของข้อมูลทั้งระบบ (YYYY-MM) หรือ null
 *   provinceTotals: { province, netIncome }[] ของช่วงที่เลือก
 * คืน { key, tone: 'up' | 'down' | 'info', text, communityKey? }[]
 */
export function buildDigest({ comparison, communitiesInScope, cleanedRows, latestMonth, provinceTotals }) {
  const items = [];
  const provinceOf = new Map(communitiesInScope.map((c) => [c.community_key, c.province]));

  if (comparison) {
    const eligible = comparison.communities.filter(
      (c) => c.pct !== null && c.pairedMonths >= MIN_PAIRED_MONTHS && c.previousNet > 0
    );
    const riser = [...eligible].sort((a, b) => b.pct - a.pct)[0];
    if (riser && riser.pct >= NOTABLE_CHANGE_PCT) {
      items.push({
        key: 'riser',
        tone: 'up',
        communityKey: riser.key,
        text: `ชุมชน${riser.key} (${provinceOf.get(riser.key) || '-'}) มีรายได้สุทธิเพิ่มขึ้น ${fmtPct(riser.pct)}% จากเดือนเดียวกันของปีก่อน เป็นการเพิ่มที่สูงที่สุดในขอบเขตที่เลือก`,
      });
    }
    const faller = [...eligible].sort((a, b) => a.pct - b.pct)[0];
    if (faller && faller.pct <= -NOTABLE_CHANGE_PCT) {
      items.push({
        key: 'faller',
        tone: 'down',
        communityKey: faller.key,
        text: `ชุมชน${faller.key} (${provinceOf.get(faller.key) || '-'}) มีรายได้สุทธิลดลง ${fmtPct(faller.pct)}% จากเดือนเดียวกันของปีก่อน ควรสอบถามสาเหตุ เพราะอาจเป็นผลของฤดูกาลหรือการกรอกข้อมูล`,
      });
    }
  }

  if (latestMonth) {
    const latestIdx = monthIndex(latestMonth);
    const lastByCommunity = new Map();
    cleanedRows.forEach((r) => {
      const prev = lastByCommunity.get(r.community_key);
      if (!prev || r.month > prev) lastByCommunity.set(r.community_key, r.month);
    });
    const stale = communitiesInScope.filter((c) => {
      const last = lastByCommunity.get(c.community_key);
      return !last || latestIdx - monthIndex(last) >= STALE_MONTHS;
    });
    if (stale.length > 0) {
      items.push({
        key: 'stale',
        tone: 'info',
        text: `${fmtInt(stale.length)} ชุมชนยังไม่มีข้อมูลใหม่ในช่วง ${STALE_MONTHS} เดือนล่าสุดของระบบ ควรติดตามให้ส่งข้อมูลเพื่อให้ภาพรวมครบถ้วน`,
      });
    }
  }

  const positive = (provinceTotals || []).filter((p) => p.netIncome > 0);
  const total = positive.reduce((sum, p) => sum + p.netIncome, 0);
  if (positive.length >= 3 && total > 0) {
    const top = [...positive].sort((a, b) => b.netIncome - a.netIncome)[0];
    const share = (top.netIncome / total) * 100;
    if (share >= CONCENTRATION_PCT) {
      items.push({
        key: 'concentration',
        tone: 'info',
        text: `จังหวัด${top.province} มีสัดส่วน ${fmtPct(share)}% ของรายได้สุทธิรวมในช่วงที่เลือก ภาพรวมจึงขึ้นกับจังหวัดนี้มาก`,
      });
    }
  }

  return items;
}
