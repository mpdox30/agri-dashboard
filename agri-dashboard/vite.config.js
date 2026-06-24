import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // *** ต้องแก้ก่อน deploy ขึ้น GitHub Pages ***
  // ถ้า repo ชื่อ "agri-dashboard" บน GitHub (เช่น URL จะเป็น
  // https://YOUR_USERNAME.github.io/agri-dashboard/) ให้ตั้งเป็น '/agri-dashboard/'
  // (ชื่อ repo ของคุณเอง ไม่ใช่คำว่า agri-dashboard ตรงๆ ถ้าตั้ง repo ชื่ออื่น)
  // ถ้า repo ชื่อ YOUR_USERNAME.github.io พอดี (เว็บหลักของบัญชี ไม่ใช่ repo ย่อย)
  // ให้ใช้ '/' เหมือนเดิม ไม่ต้องแก้อะไร
  base: '/agri-dashboard/',
})
