// src/components/dashboard/DataSourceBadge.tsx

interface Props {
  weatherFetchedAt?: string;
  aqiFetchedAt?: string;
}

export function DataSourceBadge({ weatherFetchedAt, aqiFetchedAt }: Props) {
  const format = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex gap-3 text-xs text-gray-500 mt-1 flex-wrap">
      <span className="flex items-center gap-1">
        🌐 <span className="text-green-400 font-semibold">Live</span> Weather (OpenWeatherMap)
        · Updated {format(weatherFetchedAt)}
      </span>
      <span className="flex items-center gap-1">
        🌐 <span className="text-green-400 font-semibold">Live</span> AQI (WAQI API) · Updated{" "}
        {format(aqiFetchedAt)}
      </span>
    </div>
  );
}
