// src/components/SubTabs.jsx
import './SubTabs.css';

/**
 * props:
 *   tabs: { key: string, label: string, count?: number | string }[]
 *   activeKey: string
 *   onChange: (key: string) => void
 */
export default function SubTabs({ tabs, activeKey, onChange }) {
  return (
    <div className="subtabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeKey === tab.key ? 'subtab-btn active' : 'subtab-btn'}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
