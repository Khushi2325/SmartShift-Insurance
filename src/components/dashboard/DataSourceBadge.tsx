export function DataSourceBadge() {
  return (
    <div className="flex gap-2 text-xs justify-center">
      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs">
        🌤️ Live Weather
      </span>
      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/20 text-xs">
        💨 Live AQI
      </span>
    </div>
  );
}
