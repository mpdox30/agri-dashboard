/**
 * ApprovalApi.gs — ฟังก์ชันสำหรับหน้าจอ "ตรวจสอบ/อนุมัติ"
 *
 * getPendingSubmissionsForReview() เรียกผ่าน doGet (?action=pending_review)
 * handleApproveSubmission() / handleRejectSubmission() เรียกผ่าน doPost
 * (action="approve_submission" / "reject_submission") — ดูเส้นทางใน EntryApi.gs
 *
 * ทั้งสองฟังก์ชันอนุมัติ/ตีกลับต้องใส่รหัสผ่านเดียวกับหน้ากรอกข้อมูล (รหัสผ่านร่วม
 * เดียวกันทั้งระบบตามที่ตกลงไว้ ไม่แยกรหัสทีมกลาง/ตัวแทนพื้นที่)
 */

/**
 * คืนรายการ submission ที่ status=pending ทั้งหมด จัดกลุ่มตาม submission_id
 * พร้อมข้อมูล diff เทียบกับเดือนก่อนของสมาชิกคนเดียวกัน (คำนวณ runtime)
 *
 * โครงสร้างผลลัพธ์ (1 รายการต่อ submission_id):
 * {
 *   submission_id, community_key, month, submitted_by, submitted_at,
 *   members: [
 *     { full_name, join_year, ...VALUE_FIELDS, previous_month_values: {...} หรือ null }
 *   ]
 * }
 */
function getPendingSubmissionsForReview() {
  const allPending = readSheetAsObjects(SHEET_PENDING_SUBMISSIONS);
  const pendingOnly = allPending.filter(function (row) { return row.status === 'pending'; });

  // จัดกลุ่มตาม submission_id
  const grouped = {};
  pendingOnly.forEach(function (row) {
    if (!grouped[row.submission_id]) {
      grouped[row.submission_id] = {
        submission_id: row.submission_id,
        community_key: row.community_key,
        month: row.month,
        submitted_by: row.submitted_by,
        submitted_at: row.submitted_at,
        members: [],
      };
    }
    grouped[row.submission_id].members.push(row);
  });

  const submissions = Object.keys(grouped).map(function (key) { return grouped[key]; });

  // เติม previous_month_values ให้แต่ละสมาชิก (เทียบกับ monthly_records เดือนก่อน)
  const allRecords = readSheetAsObjects(SHEET_MONTHLY_RECORDS);
  submissions.forEach(function (sub) {
    const prevMonth = getPreviousMonth(sub.month);
    sub.members.forEach(function (member) {
      const prevRecord = allRecords.filter(function (r) {
        return r.community_key === sub.community_key &&
               r.month === prevMonth &&
               r.full_name === member.full_name;
      })[0];
      member.previous_month_values = prevRecord ? pickValueFields(prevRecord) : null;
      member.anomaly_flags = computeAnomalyFlags(member, member.previous_month_values);
    });
  });

  // เรียงตามวันที่ส่งล่าสุดก่อน
  submissions.sort(function (a, b) { return b.submitted_at.localeCompare(a.submitted_at); });

  return submissions;
}

/** คืนเดือนก่อนหน้าในรูปแบบ YYYY-MM จากเดือนที่ระบุ */
function getPreviousMonth(monthStr) {
  const parts = monthStr.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return year + '-' + (month < 10 ? '0' + month : String(month));
}

function pickValueFields(record) {
  const out = {};
  VALUE_FIELDS.forEach(function (f) { out[f] = record[f]; });
  return out;
}

/**
 * เทียบค่าแต่ละช่องกับเดือนก่อน ถ้าต่างเกิน 300% (เกณฑ์คงที่ทั่วระบบตามที่ตกลงไว้
 * ก่อน — ยังไม่ผันตามขนาดชุมชน) คืน array ของชื่อช่องที่ผิดปกติ
 */
function computeAnomalyFlags(member, previousValues) {
  if (!previousValues) return []; // ไม่มีเดือนก่อนให้เทียบ (สมาชิกใหม่) ไม่ flag
  const THRESHOLD = 3.0; // 300%
  const flags = [];
  VALUE_FIELDS.forEach(function (field) {
    const curr = Number(member[field]) || 0;
    const prev = Number(previousValues[field]) || 0;
    if (prev === 0 && curr === 0) return;
    if (prev === 0 && curr > 0) {
      flags.push(field); // จากไม่มีกลายเป็นมี ก็ถือว่าน่าสังเกต
      return;
    }
    const changeRatio = Math.abs(curr - prev) / prev;
    if (changeRatio > THRESHOLD) {
      flags.push(field);
    }
  });
  return flags;
}

/**
 * อนุมัติ submission: copy ทุกแถวของ submission_id นี้จาก pending_submissions
 * ไปยัง monthly_records แล้วคำนวณยอดรวมใหม่เข้า monthly_summary ทันที จากนั้นเปลี่ยน
 * status เป็น approved ใน pending_submissions (ไม่ลบแถวเดิม เก็บไว้เป็นหลักฐาน/ประวัติ)
 */
function handleApproveSubmission(body) {
  if (!checkApprovalPassword(body.password)) {
    return jsonResponse({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  const submissionId = body.submission_id;
  const reviewerNote = body.reviewer_note || '';
  if (!submissionId) {
    return jsonResponse({ ok: false, error: 'ต้องระบุ submission_id' });
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_PENDING_SUBMISSIONS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIndex = {};
  headers.forEach(function (h, i) { colIndex[h] = i; });

  const matchingRowIndexes = []; // 0-indexed ภายใน values (ไม่รวม header)
  const recordsToApprove = [];

  for (let r = 1; r < values.length; r++) {
    if (values[r][colIndex['submission_id']] === submissionId) {
      matchingRowIndexes.push(r);
      const obj = {};
      headers.forEach(function (h, i) {
        let value = values[r][i];
        // เช็ค Date เช่นเดียวกับ readSheetAsObjects() — จุดนี้อ่านตรงจาก getValues()
        // เอง ไม่ผ่าน readSheetAsObjects() จึงต้องป้องกันซ้ำ ไม่งั้นค่าที่เพี้ยนจะถูก
        // คัดลอกต่อเข้า monthly_records ทุกครั้งที่อนุมัติข้อมูลใหม่
        if (h === 'month' && value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
        }
        obj[h] = value;
      });
      recordsToApprove.push(obj);
    }
  }

  if (matchingRowIndexes.length === 0) {
    return jsonResponse({ ok: false, error: 'ไม่พบ submission_id นี้ หรืออนุมัติ/ตีกลับไปแล้ว' });
  }

  // --- คัดลอกเข้า monthly_records (เฉพาะคอลัมน์ที่ monthly_records ใช้จริง) ---
  const monthlyRecordsCols = ['community_key', 'month', 'full_name', 'join_year'].concat(VALUE_FIELDS);
  appendRowsToSheet(SHEET_MONTHLY_RECORDS, monthlyRecordsCols, recordsToApprove);

  // --- คำนวณยอดรวมใหม่เข้า monthly_summary ทันที (แก้บั๊ก dashboard ไม่อัปเดตยอด) ---
  recalculateMonthlySummaryRow(recordsToApprove[0].community_key, recordsToApprove[0].month);

  // --- เปลี่ยน status เป็น approved ในแถวเดิม (ไม่ลบ) ---
  const now = formatDateTime(new Date());
  matchingRowIndexes.forEach(function (r) {
    sheet.getRange(r + 1, colIndex['status'] + 1).setValue('approved');
    sheet.getRange(r + 1, colIndex['reviewer_note'] + 1).setValue(reviewerNote);
    sheet.getRange(r + 1, colIndex['reviewed_at'] + 1).setValue(now);
  });

  return jsonResponse({
    ok: true,
    submission_id: submissionId,
    approved_member_count: recordsToApprove.length,
  });
}

/**
 * ตีกลับ submission: เปลี่ยน status เป็น rejected พร้อมบันทึก reviewer_note
 * ไม่ลบแถว ไม่แก้ไข monthly_records — ตัวแทนพื้นที่เข้ามากรอกใหม่ได้ทันที
 * (เดือนนี้จะไม่ถูกล็อกอีกต่อไป เพราะ getLockInfo เช็คเฉพาะ status=pending)
 */
function handleRejectSubmission(body) {
  if (!checkApprovalPassword(body.password)) {
    return jsonResponse({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  const submissionId = body.submission_id;
  const reviewerNote = body.reviewer_note || '';
  if (!submissionId) {
    return jsonResponse({ ok: false, error: 'ต้องระบุ submission_id' });
  }
  if (!reviewerNote) {
    return jsonResponse({ ok: false, error: 'กรุณาระบุเหตุผลที่ตีกลับใน reviewer_note' });
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_PENDING_SUBMISSIONS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIndex = {};
  headers.forEach(function (h, i) { colIndex[h] = i; });

  let matchCount = 0;
  const now = formatDateTime(new Date());
  for (let r = 1; r < values.length; r++) {
    if (values[r][colIndex['submission_id']] === submissionId) {
      sheet.getRange(r + 1, colIndex['status'] + 1).setValue('rejected');
      sheet.getRange(r + 1, colIndex['reviewer_note'] + 1).setValue(reviewerNote);
      sheet.getRange(r + 1, colIndex['reviewed_at'] + 1).setValue(now);
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return jsonResponse({ ok: false, error: 'ไม่พบ submission_id นี้ หรืออนุมัติ/ตีกลับไปแล้ว' });
  }

  return jsonResponse({ ok: true, submission_id: submissionId, rejected_member_count: matchCount });
}