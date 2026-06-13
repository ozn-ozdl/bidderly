import { cn } from "@/lib/cn";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  showDots?: boolean;
};

export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke,
  fill,
  className,
  showDots = false,
}: SparklineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`))
    .join(" ");

  const areaPath = `${path} L${(data.length - 1) * stepX} ${height} L0 ${height} Z`;

  return (
    <svg
      className={cn("block", className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Trend sparkline"
    >
      {fill ? <path d={areaPath} fill={fill} /> : null}
      <path
        d={path}
        fill="none"
        stroke={stroke ?? "currentColor"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots
        ? points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.5} fill={stroke ?? "currentColor"} />
          ))
        : null}
    </svg>
  );
}
