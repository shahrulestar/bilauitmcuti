export function CalendarHeader() {
  const textColor = 'text-foreground';
  const mutedColor = 'text-muted-foreground';
  
  // Get current year in Malaysia timezone (UTC+8)
  const currentYear = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"})).getFullYear();

  return (
    <div suppressHydrationWarning className="flex flex-col justify-center items-start gap-[2px] transition-none" style={{ transition: 'none' }}>
      {/* Year label */}
      <div className={`mb-2 text-sm ${mutedColor} transition-none`} suppressHydrationWarning style={{ transition: 'none' }}>{currentYear}</div>

      {/* Main heading with custom typography */}
      <h1 className={`mb-2 font-semibold leading-[2.5rem] tracking-tight text-5xl ${textColor} transition-none`} suppressHydrationWarning style={{ transition: 'none' }}>
        Bila <span className="text-[#8b5cf6]">UiTM</span> Cuti?
      </h1>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-start text-sm transition-none" role="list" aria-label="Activity type legend" suppressHydrationWarning style={{ transition: 'none' }}>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#d1d5db]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Registration</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#8b5cf6]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Lecture</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#dc2626]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Examination</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#10b981]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Break</span>
        </div>
      </div>
    </div>
  );
}
