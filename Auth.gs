/**
 * Auth.gs — จัดการรหัสผ่านแยก 2 ระดับ
 *
 * ENTRY_PASSWORD    — ตัวแทนพื้นที่ (กรอกข้อมูล)
 * APPROVAL_PASSWORD — ทีมกลาง (อนุมัติ/ตีกลับ)
 *
 * รหัสผ่านเก็บใน Script Properties ไม่ได้ hardcode ในโค้ด
 * ต้องรัน setPasswords() ครั้งเดียวก่อนใช้งาน
 */

/** ตรวจรหัสผ่านตัวแทนพื้นที่ (กรอกข้อมูล) */
function checkEntryPassword(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ENTRY_PASSWORD');
  return stored !== null && String(password) === stored;
}

/** ตรวจรหัสผ่านทีมกลาง (อนุมัติ/ตีกลับ) */
function checkApprovalPassword(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('APPROVAL_PASSWORD');
  return stored !== null && String(password) === stored;
}

/**
 * *** รันครั้งเดียวจาก Apps Script editor เพื่อตั้งรหัสผ่าน ***
 * ไม่ต้อง deploy version ใหม่หลังรัน
 * ถ้าต้องการเปลี่ยนรหัสในอนาคต แก้ตัวเลขด้านล่างแล้วรันซ้ำได้เลย
 */
function setPasswords() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ENTRY_PASSWORD', '123456789');     // ตัวแทนพื้นที่
  props.setProperty('APPROVAL_PASSWORD', '1234567890'); // ทีมกลาง
  Logger.log('ตั้งรหัสผ่านเรียบร้อยแล้ว');
  Logger.log('ENTRY_PASSWORD    (ตัวแทนพื้นที่): ' + props.getProperty('ENTRY_PASSWORD'));
  Logger.log('APPROVAL_PASSWORD (ทีมกลาง)      : ' + props.getProperty('APPROVAL_PASSWORD'));
}