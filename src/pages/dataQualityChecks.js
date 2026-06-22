// src/pages/dataQualityChecks.js
//
// ฟังก์ชันตรวจสอบคุณภาพข้อมูลทั่วทั้งระบบ (ทุกชุมชน) — เป็นเวอร์ชัน JS ของสคริปต์
// Python ที่ใช้สแกนตอนสร้าง near_duplicate_names.csv, suspected_carryover_duplicates.csv,
// likely_unentered_month_runs.csv ก่อนหน้านี้ ทำให้รันได้ตรงในแดชบอร์ดเลย ไม่ต้องรอ
// ให้สแกนมือทีหลัง

import { nameSimilarity } from './entryFormHelpers';
import { findLikelyUnenteredMonths } from './communityAggregations';

const VALUE_FIELDS_RECORDS = ['บริโภคในครัวเรือน', 'ขาย', 'แบ่งปัน', 'ซื้อ', 'ผลิตเอง', 'รับฟรี/อื่นๆ'];

// --- 1) ชื่อสมาชิกที่คล้ายกันมากในชุมชนเดียวกัน (อาจเป็นคนเดียวกัน สะกดไม่ตรงกัน) ---

/**
 * สแกนหาคู่ชื่อที่คล้ายกันมาก ภายในชุมชนเดียวกัน (ไม่เทียบข้ามชุมชน เพราะคนละพื้นที่
 * ไม่น่าใช่คนเดียวกัน) จาก monthly_records ทั้งหมด
 * คืน array เรียงตามความคล้ายมาก->น้อย: { communityKey, nameA, nameB, similarity, confidence }
 */
export function findNearDuplicateNames(allRecords, threshold = 0.78) {
  const namesByCommunity = new Map();
  allRecords.forEach((r) => {
    if (!namesByCommunity.has(r.community_key)) namesByCommunity.set(r.community_key, new Set());
    namesByCommunity.get(r.community_key).add(r.full_name);
  });

  const results = [];
  namesByCommunity.forEach((nameSet, communityKey) => {
    const names = Array.from(nameSet).sort();
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const a = names[i];
        const b = names[j];
        const score = nameSimilarity(a, b);
        if (score >= threshold) {
          const stripped = (s) => s.replace(/[\s.()]+/g, '');
          let confidence = 'ปานกลาง — ควรตรวจสอบ';
          if (stripped(a) === stripped(b)) confidence = 'สูงมาก (ต่างกันแค่เว้นวรรค/วงเล็บ/จุด)';
          else if (score >= 0.95) confidence = 'สูง';
          results.push({ communityKey, nameA: a, nameB: b, similarity: score, confidence });
        }
      }
    }
  });

  results.sort((x, y) => y.similarity - x.similarity);
  return results;
}

// --- 2) ค่าซ้ำข้ามปี (เดือนเดียวกัน คนเดียวกัน ค่าเป๊ะเท่าปีก่อน — อาจเป็นการคัดลอกข้าม) ---

function pickValueTuple(r) {
  return VALUE_FIELDS_RECORDS.map((f) => r[f]);
}

function tuplesEqual(a, b) {
  return a.every((v, i) => v === b[i]);
}

function tupleHasNonZero(tuple) {
  return tuple.some((v) => (Number(v) || 0) !== 0);
}

/**
 * สแกนหา (ชุมชน, เดือน) ที่มีค่าของสมาชิกหลายคนเหมือนเดือนเดียวกันของปีก่อนหน้าเป๊ะ ๆ
 * (สงสัยว่าเป็นการคัดลอกแผ่นปีก่อนมาใช้เป็นต้นแบบ แล้วลืมแก้บางเดือน)
 * คืน array: { communityKey, month, comparedToMonth, duplicatedMembers, totalMembers, duplicatedPct }
 */
export function findCarryoverDuplicates(allRecords, minDuplicatedMembers = 3, minPct = 30) {
  const byCommunity = new Map();
  allRecords.forEach((r) => {
    if (!byCommunity.has(r.community_key)) byCommunity.set(r.community_key, []);
    byCommunity.get(r.community_key).push(r);
  });

  const results = [];
  byCommunity.forEach((rows, communityKey) => {
    const byMonthThenName = new Map(); // month -> Map(full_name -> tuple)
    rows.forEach((r) => {
      if (!byMonthThenName.has(r.month)) byMonthThenName.set(r.month, new Map());
      byMonthThenName.get(r.month).set(r.full_name, pickValueTuple(r));
    });

    byMonthThenName.forEach((currentMap, month) => {
      const [y, m] = month.split('-');
      const prevMonth = `${Number(y) - 1}-${m}`;
      const prevMap = byMonthThenName.get(prevMonth);
      if (!prevMap) return;
      let dupCount = 0;
      let exampleMember = '';
      currentMap.forEach((tuple, name) => {
        const prevTuple = prevMap.get(name);
        if (prevTuple && tuplesEqual(tuple, prevTuple) && tupleHasNonZero(tuple)) {
          dupCount += 1;
          if (!exampleMember) exampleMember = name;
        }
      });
      const total = currentMap.size;
      const pct = total > 0 ? (dupCount / total) * 100 : 0;
      if (dupCount >= minDuplicatedMembers || pct >= minPct) {
        if (dupCount > 0) {
          results.push({
            communityKey,
            month,
            comparedToMonth: prevMonth,
            duplicatedMembers: dupCount,
            totalMembers: total,
            duplicatedPct: Math.round(pct * 10) / 10,
            exampleMember,
          });
        }
      }
    });
  });

  results.sort((a, b) => b.duplicatedPct - a.duplicatedPct);
  return results;
}

// --- 3) ช่วงเดือนที่น่าจะไม่ได้กรอกข้อมูลจริง (0 ต่อเนื่องยาว) ทั่วทั้งระบบ ---

/**
 * เรียก findLikelyUnenteredMonths() ของทุกชุมชน แล้วสรุปเป็นช่วง (run) พร้อมระบุว่า
 * เป็นเดือนอนาคตที่ยังไม่เกิดขึ้นจริง (ไม่ต้องตรวจสอบ) หรือช่วงในอดีตที่ควรตรวจสอบจริง
 */
export function findUnenteredMonthRunsAcrossSystem(allSummaryRows, currentMonth, minRunLength = 4) {
  const byCommunity = new Map();
  allSummaryRows.forEach((r) => {
    if (!byCommunity.has(r.community_key)) byCommunity.set(r.community_key, []);
    byCommunity.get(r.community_key).push(r);
  });

  const results = [];
  byCommunity.forEach((rows, communityKey) => {
    const excluded = findLikelyUnenteredMonths(rows, minRunLength);
    if (excluded.size === 0) return;
    const sortedMonths = Array.from(excluded).sort();
    // จัดกลุ่มเดือนที่ถูกตัดออกเป็นช่วงต่อเนื่อง (อาจมีหลายช่วงต่อชุมชนถ้าไม่ติดกัน)
    let runStart = sortedMonths[0];
    let prev = sortedMonths[0];
    for (let i = 1; i <= sortedMonths.length; i += 1) {
      const cur = sortedMonths[i];
      const [py, pm] = prev.split('-').map(Number);
      const expectedNext = pm === 12 ? `${py + 1}-01` : `${py}-${String(pm + 1).padStart(2, '0')}`;
      if (cur !== expectedNext) {
        const isFuture = prev >= currentMonth;
        results.push({
          communityKey,
          runStart,
          runEnd: prev,
          runLengthMonths: sortedMonths.indexOf(prev) - sortedMonths.indexOf(runStart) + 1,
          category: isFuture ? 'เดือนอนาคตที่ยังไม่เกิดขึ้นจริง' : 'ช่วงในอดีตที่ควรตรวจสอบ',
        });
        runStart = cur;
      }
      prev = cur;
    }
  });

  results.sort((a, b) => {
    const aFuture = a.category.includes('อนาคต');
    const bFuture = b.category.includes('อนาคต');
    if (aFuture !== bFuture) return aFuture ? 1 : -1;
    return b.runLengthMonths - a.runLengthMonths;
  });
  return results;
}
