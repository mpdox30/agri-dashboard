// สคริปต์ตรวจสอบว่า SQL view agri_income.monthly_summary_cleaned ให้ผลตรงกับ
// cleanAllSummaryRows() ของจริงใน communityAggregations.js หรือไม่ (per-community row count)
import { createClient } from '@supabase/supabase-js';
import { cleanAllSummaryRows } from './src/pages/communityAggregations.js';

const SUPABASE_URL = 'https://khfixycxjwxcpayiwxap.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1Iju7_QORaqhtYE4HryrGQ_KzYGx_1i';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { db: { schema: 'agri_income' } });

async function fetchAll(table) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').order('community_key').order('month').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const rawDb = await fetchAll('monthly_summary');
// normalize month "YYYY-MM-DD" -> "YYYY-MM" เหมือนที่ src/api/supabase.js ทำจริงก่อนส่งให้หน้าเว็บ
const raw = rawDb.map((r) => ({ ...r, month: r.month.slice(0, 7) }));
const cleaned = cleanAllSummaryRows(raw);

const cleanedCountByCommunity = new Map();
cleaned.forEach((r) => {
  cleanedCountByCommunity.set(r.community_key, (cleanedCountByCommunity.get(r.community_key) || 0) + 1);
});

console.log('JS raw total:', raw.length);
console.log('JS cleaned total:', cleaned.length);

// เขียนผลลัพธ์ per-community ลงไฟล์ให้ SQL ฝั่ง Supabase มาเทียบ
import { writeFileSync } from 'fs';
const rows = Array.from(cleanedCountByCommunity.entries()).map(([community_key, cnt]) => ({ community_key, js_cleaned_count: cnt }));
writeFileSync('/tmp_js_cleaned_counts.json', JSON.stringify(rows, null, 2));
console.log('communities represented in cleaned set:', rows.length);
