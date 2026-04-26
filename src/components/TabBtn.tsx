export function TabBtn({
  icon, label, active, onClick, highlight, badge, subLabel,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
  badge?: number;
  subLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-all active:scale-95 relative"
      style={{ color: active ? '#D32F2F' : highlight ? '#FF8A80' : '#AAA' }}
    >
      <span style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      {subLabel && (
        <span style={{ fontSize: 9, color: '#D32F2F', lineHeight: 1 }}>{subLabel}</span>
      )}
      {badge !== undefined && (
        <div
          className="absolute flex items-center justify-center rounded-full font-bold text-white"
          style={{
            top: 2,
            right: '50%',
            transform: 'translateX(18px)',
            minWidth: 18,
            height: 18,
            fontSize: 10,
            backgroundColor: '#A32D2D',
            padding: '0 3px',
          }}
        >
          {badge}
        </div>
      )}
    </button>
  );
}
