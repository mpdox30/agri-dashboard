// src/api/supabase.js
//
// API client ใหม่ ใช้แทน src/api/appsScript.js เดิม — export ชื่อฟังก์ชันเหมือนเดิม
// ทุกตัวเพื่อให้หน้าเว็บ (Homepage.jsx, CommunityView.jsx, EntryForm.jsx,
// ApprovalQueue.jsx) ไม่ต้องแก้โค้ดเลย แค่เปลี่ยน import จาก './appsScript' เป็น
// './supabase'
//
// ฝั่งอ่าน (getCommunities/getMonthlyRecords/getMonthlySummary) เรียก PostgREST
// ตรงผ่าน supabase-js — ใช้งานได้ทันที
//
// ฝั่งเขียน (checkLock/getPendingReview/submitEntry/approveSubmission/
// rejectSubmission) เรียก Supabase Edge Functions ที่ยังไม่ได้ deploy — รอ deploy
// ฟังก์ชันชื่อ check-lock / get-pending-review / submit-entry / approve-submission /
// reject-submission ก่อนถึงจะใช้งานได้จริง (ตอนนี้เรียกแล้วจะได้ error จาก Supabase
// ว่าหา function ไม่เจอ ซึ่งเป็นพฤติกรรมที่ถูกต้องแล้วในระหว่างรอ deploy)

import { supabase } from './supabaseClient.js';

const PAGE_SIZE = 1000; // ขนาดหน้าต่อการดึงข้อมูล 1 ครั้ง (PostgREST จำกัด max rows ต่อ request)

/** ดึงข้อมูลทุกแถวจากตาราง โดยวนหน้าอัตโนมัติถ้าข้อมูลเกิน PAGE_SIZE */
async function fetchAll(table, { communityKey, orderBy } = {}) {
  const all = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (communityKey) query = query.eq('community_key', communityKey);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * ป้องกันไว้อีกชั้นเหมือนของเดิมใน appsScript.js: คอลัมน์ month ในตาราง Postgres เป็น
 * ชนิด date จริง ๆ (คืนมาเป็น "YYYY-MM-DD") แต่ทั้งแอปเทียบ/แสดงผลด้วยรูปแบบ "YYYY-MM"
 * มาตลอด (จากตอนที่ backend เดิมเป็น Google Sheets เก็บ month เป็น plain text)
 * ฟังก์ชันนี้ตัดให้เหลือ YYYY-MM เสมอ เพื่อให้โค้ดส่วนอื่นทั้งหมด (buildMemberRoster,
 * getPreviousMonth, การเทียบ string ตรง ๆ ในหลายที่) ทำงานเหมือนเดิมทุกอย่าง
 */
function normalizeMonth(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : value;
  }
  return value;
}

// ตาราง monthly_records ในสเปรดชีตเดิมใช้ชื่อคอลัมน์เป็นภาษาไทยตรง ๆ สำหรับ 6 ช่อง
// มูลค่า (VALUE_FIELDS ใน entryFormHelpers.js/approvalQueueHelpers.js ก็ index ด้วยชื่อ
// พวกนี้ตรง ๆ) แต่ตาราง Postgres ใหม่ใช้ชื่อคอลัมน์ภาษาอังกฤษ (อ่านง่ายกว่าฝั่ง SQL)
// จึงต้อง map กลับเป็นชื่อภาษาไทยตอนคืนค่าให้ frontend เพื่อไม่ต้องแก้โค้ดหน้าเว็บเลย
const RECORD_FIELD_MAP = {
  household_consumption: 'บริโภคในครัวเรือน',
  sale: 'ขาย',
  sharing: 'แบ่งปัน',
  purchase: 'ซื้อ',
  self_produced: 'ผลิตเอง',
  free_other: 'รับฟรี/อื่นๆ',
};

function mapRecordRow(row) {
  const mapped = {
    community_key: row.community_key,
    month: normalizeMonth(row.month),
    full_name: row.full_name,
    join_year: row.join_year,
  };
  Object.entries(RECORD_FIELD_MAP).forEach(([dbColumn, thaiKey]) => {
    mapped[thaiKey] = row[dbColumn];
  });
  return mapped;
}

// --- ฝั่งอ่าน: ใช้งานได้จริงแล้ว ---

export async function getCommunities() {
  return fetchAll('communities', { orderBy: 'community_key' });
}

export async function getMonthlyRecords(communityKey) {
  const rows = await fetchAll('monthly_records', { communityKey, orderBy: 'month' });
  return rows.map(mapRecordRow);
}

export async function getMonthlySummary(communityKey) {
  const rows = await fetchAll('monthly_summary', { communityKey, orderBy: 'month' });
  return rows.map((row) => ({ ...row, month: normalizeMonth(row.month) }));
}

/**
 * สรุปยอดรายปีงบต่อชุมชน จาก materialized view agri_income.mv_community_yearly_totals
 * (คำนวณไว้ล่วงหน้าฝั่ง DB แล้ว รวมทั้งตัดเดือนที่ "น่าจะไม่ได้กรอกจริง" ออกด้วยตรรกะ
 * เดียวกับ cleanAllSummaryRows() ใน communityAggregations.js — ใช้เป็นทางลัดสำหรับ
 * รายงาน/แดชบอร์ดที่ต้องการยอดรายปีเร็ว ๆ โดยไม่ต้องดึง monthly_summary ทั้งหมดมา
 * คำนวณฝั่ง frontend เอง ปัจจุบัน view นี้จะถูก refresh อัตโนมัติทุกครั้งที่มีการ
 * approve ข้อมูลใหม่ (ดู approve-submission Edge Function)
 */
export async function getYearlyTotals(communityKey) {
  let query = supabase
    .from('mv_community_yearly_totals')
    .select('*')
    .order('fiscal_year_key', { ascending: true });
  if (communityKey) query = query.eq('community_key', communityKey);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// --- ฝั่งเขียน: รอ deploy Edge Functions (ดูหมายเหตุด้านบนของไฟล์) ---

async function invokeFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError ของ supabase-js ใส่ response จริงไว้ใน error.context
    let detail = null;
    if (error.context && typeof error.context.json === 'function') {
      detail = await error.context.json().catch(() => null);
    }
    const message = (detail && detail.error) || error.message || 'เรียก API ไม่สำเร็จ';
    const err = new Error(message);
    err.locked = !!(detail && detail.locked);
    throw err;
  }
  return data;
}

export function checkLock(communityKey, month) {
  return invokeFn('check-lock', { community_key: communityKey, month });
}

export function getPendingReview(password) {
  return invokeFn('get-pending-review', { password });
}

export function submitEntry({ password, communityKey, month, submittedBy, members }) {
  return invokeFn('submit-entry', {
    password,
    community_key: communityKey,
    month,
    submitted_by: submittedBy,
    members,
  });
}

export function approveSubmission({ password, submissionId, reviewerNote }) {
  return invokeFn('approve-submission', {
    password,
    submission_id: submissionId,
    reviewer_note: reviewerNote,
  });
}

export function rejectSubmission({ password, submissionId, reviewerNote }) {
  return invokeFn('reject-submission', {
    password,
    submission_id: submissionId,
    reviewer_note: reviewerNote,
  });
}
