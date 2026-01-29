'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';

interface StanceData {
  stance: string;
  count: number;
  percent: number;
}

interface StanceChartProps {
  data: StanceData[];
  title?: string;
  variant?: 'pie' | 'bar';
}

const STANCE_COLORS: Record<string, string> = {
  support: '#22c55e',  // green
  oppose: '#ef4444',   // red
  mixed: '#f59e0b',    // amber
  unclear: '#94a3b8',  // slate
};

const STANCE_LABELS: Record<string, string> = {
  support: 'Supporting',
  oppose: 'Opposing',
  mixed: 'Mixed',
  unclear: 'Unclear',
};

interface TooltipPayload {
  payload: {
    name: string;
    value: number;
    percent: number;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          {data.value} items ({data.percent.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
}

export function StanceChart({
  data,
  title = 'Stance Distribution',
  variant = 'pie',
}: StanceChartProps) {
  // Filter out zero values for cleaner display (check both count and percent)
  const filteredData = data.filter(d => d.count > 0 || d.percent > 0);

  // Map to display-friendly format
  const chartData = filteredData.map(d => ({
    name: STANCE_LABELS[d.stance] || d.stance,
    value: d.count || Math.round(d.percent), // Use percent as fallback for display
    percent: d.percent,
    color: STANCE_COLORS[d.stance] || '#94a3b8',
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No stance data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {variant === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value, entry) => {
                    const item = chartData.find(d => d.name === value);
                    return `${value}: ${item?.percent.toFixed(0) ?? 0}%`;
                  }}
                />
              </PieChart>
            ) : (
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="percent"
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Summary stats below chart */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground ml-1">
                  ({item.value})
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
