// src/components/charts/DataTableToggle.jsx
//
// ตัวเลือก "ดูค่าเป็นตาราง" ใต้กราฟ: ให้ผู้อ่านที่ต้องการตัวเลขเป๊ะๆ หรือใช้โปรแกรมอ่านหน้าจอเข้าถึงข้อมูลชุดเดียวกับกราฟ
import './charts.css';

/**
 * props:
 *   columns: { key, label, align? }[]
 *   rows: object[]  แต่ละแถวเป็นอ็อบเจ็กต์ตาม key ของคอลัมน์ (ค่าที่จัดรูปแบบเป็นข้อความแล้ว)
 *   summary: ข้อความบนปุ่ม
 *   caption: คำบรรยายตาราง (อ่านออกเสียงโดย screen reader)
 */
export default function DataTableToggle({ columns, rows, summary = 'ดูค่าเป็นตาราง', caption }) {
  if (!rows || !rows.length) return null;
  return (
    <details className="data-table-toggle">
      <summary>{summary}</summary>
      <div className="data-table-toggle__scroll">
        <table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" style={c.align ? { textAlign: c.align } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key ?? i}>
                {columns.map((c) => (
                  <td key={c.key} className="tabular" style={c.align ? { textAlign: c.align } : undefined}>
                    {row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
