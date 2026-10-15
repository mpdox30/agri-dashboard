// src/components/ShareCardButton.jsx
//
// ปุ่มสร้างรูปสรุป (PNG จัตุรัส) แล้วแชร์หรือบันทึก ใช้ได้กับการ์ดระดับชุมชนและภาพรวม
import { useState } from 'react';
import { renderShareCard, shareOrDownload } from '../utils/shareCard';
import './ShareCardButton.css';

/**
 * props:
 *   buildOptions: () => options ของ renderShareCard (เรียกตอนกดปุ่ม เพื่อใช้ค่าล่าสุดเสมอ)
 *   filename: ชื่อไฟล์ภาพ
 *   shareText: ข้อความแนบตอนแชร์
 *   label: ข้อความบนปุ่ม
 */
export default function ShareCardButton({ buildOptions, filename, shareText, label = 'บันทึกเป็นรูปแชร์ไลน์' }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'busy' | 'done' | 'error'

  async function handleClick() {
    setStatus('busy');
    try {
      const blob = await renderShareCard(buildOptions());
      const result = await shareOrDownload(blob, filename, shareText);
      setStatus(result === 'cancelled' ? 'idle' : 'done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <span className="share-card-btn">
      <button type="button" onClick={handleClick} disabled={status === 'busy'}>
        {status === 'busy' ? 'กำลังสร้างรูป...' : label}
      </button>
      <span className="share-card-btn__status" role="status">
        {status === 'done' && 'เรียบร้อยแล้ว'}
        {status === 'error' && 'สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง'}
      </span>
    </span>
  );
}
