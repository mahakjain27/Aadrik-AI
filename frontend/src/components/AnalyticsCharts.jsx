import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";

export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  border: "rgba(11,11,11,0.08)",
};

const STATUS_COLORS = {
  Pending: "#eda100",
  Contacted: "#1baf7a",
  Quoted: "#4a3aa7",
  Won: "#0ca30c",
  Lost: "#d03b3b",
};

const CITY_COLOR = "#5c1030";
const BRAND_COLOR = "#1baf7a";
const GOOD_COLOR = "#0ca30c";
const CRITICAL_COLOR = "#d03b3b";

export function ChartCard({ title, subtitle, children }) {
  return (
    <div className="col-md-6">
      <div
        style={{
          background: "#ffffff",
          border: `1px solid ${INK.border}`,
          borderRadius: "16px",
          boxShadow: "var(--shadow-card)",
          padding: "20px",
          height: "100%",
        }}
      >
        <h6 style={{ fontWeight: 700, color: INK.primary, marginBottom: subtitle ? 2 : 16 }}>
          {title}
        </h6>
        {subtitle && (
          <div style={{ fontSize: "12.5px", color: INK.muted, marginBottom: 16 }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div
      style={{
        height: 280,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: INK.muted,
        fontSize: "13px",
      }}
    >
      {label}
    </div>
  );
}

function StatusTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];
  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;

  return (
    <div style={tooltipStyle}>
      <div style={tooltipTitleStyle}>
        <span style={dotStyle(entry.payload.fill)} />
        {entry.name}
      </div>
      <div style={tooltipBodyStyle}>
        {entry.value} leads · {pct}%
      </div>
    </div>
  );
}

function ValueTooltip({ active, payload, labelKey, unit = "leads" }) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];

  return (
    <div style={tooltipStyle}>
      <div style={tooltipTitleStyle}>{entry.payload[labelKey]}</div>
      <div style={tooltipBodyStyle}>
        {entry.value} {unit}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#ffffff",
  border: `1px solid ${INK.border}`,
  borderRadius: "10px",
  boxShadow: "var(--shadow-card)",
  padding: "8px 12px",
  fontSize: "13px",
};
const tooltipTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 600,
  color: INK.primary,
};
const tooltipBodyStyle = { color: INK.secondary, marginTop: 2 };
const dotStyle = (color) => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color,
  display: "inline-block",
});

function truncateLabel(value, max = 20) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function StatusAndCityCharts({ leads }) {
  const statusData = [
    { name: "Pending", value: leads.filter((l) => l.status === "Pending").length },
    { name: "Contacted", value: leads.filter((l) => l.status === "Contacted").length },
    { name: "Quoted", value: leads.filter((l) => l.status === "Quotation Sent").length },
    { name: "Won", value: leads.filter((l) => l.status === "Won").length },
    { name: "Lost", value: leads.filter((l) => l.status === "Lost").length },
  ].filter((d) => d.value > 0);

  const totalStatus = statusData.reduce((sum, d) => sum + d.value, 0);

  const cityMap = {};
  leads.forEach((lead) => {
    if (!lead.delivery_city) return;
    cityMap[lead.delivery_city] = (cityMap[lead.delivery_city] || 0) + 1;
  });
  const cityData = Object.entries(cityMap)
    .map(([city, count]) => ({ city, leads: count }))
    .sort((a, b) => b.leads - a.leads);

  return (
    <>
      <ChartCard title="Leads by status" subtitle="Distribution of all leads across the pipeline">
        {totalStatus === 0 ? (
          <EmptyState label="No leads yet" />
        ) : (
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={78}
                  outerRadius={108}
                  paddingAngle={statusData.length > 1 ? 3 : 0}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip content={<StatusTooltip total={totalStatus} />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ color: INK.secondary, fontSize: "12.5px" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            <div
              style={{
                position: "absolute",
                top: "42%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: "26px", fontWeight: 700, color: INK.primary }}>
                {totalStatus}
              </div>
              <div style={{ fontSize: "11.5px", color: INK.muted, fontWeight: 600 }}>
                Total leads
              </div>
            </div>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Leads by city" subtitle="Delivery locations ranked by lead count">
        {cityData.length === 0 ? (
          <EmptyState label="No leads yet" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cityData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis
                dataKey="city"
                tickLine={false}
                axisLine={{ stroke: INK.axis }}
                tick={{ fill: INK.muted, fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: INK.muted, fontSize: 12 }}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "rgba(11,11,11,0.04)" }}
                content={<ValueTooltip labelKey="city" />}
              />
              <Bar dataKey="leads" fill={CITY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList
                  dataKey="leads"
                  position="top"
                  style={{ fill: INK.secondary, fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </>
  );
}

function MonthlyTrendChart({ leads }) {
  const monthMap = {};
  leads.forEach((lead) => {
    const d = new Date(lead.created_at);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap[key]) {
      monthMap[key] = {
        key,
        label: `${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(-2)}`,
        count: 0,
        sortDate: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
      };
    }
    monthMap[key].count += 1;
  });
  const monthData = Object.values(monthMap).sort((a, b) => a.sortDate - b.sortDate);

  return (
    <ChartCard title="Monthly trend" subtitle="New leads created per month">
      {monthData.length === 0 ? (
        <EmptyState label="No leads yet" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: INK.axis }}
              tick={{ fill: INK.muted, fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: INK.muted, fontSize: 12 }}
              width={28}
            />
            <Tooltip content={<ValueTooltip labelKey="label" />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke={CITY_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: CITY_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            >
              <LabelList
                dataKey="count"
                content={(props) => {
                  const { x, y, index, value } = props;
                  if (index !== monthData.length - 1) return null;
                  return (
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill={INK.secondary}
                    >
                      {value}
                    </text>
                  );
                }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function RankedBarChart({ title, subtitle, data, dataKey, labelKey, color }) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {data.length === 0 ? (
        <EmptyState label="No data yet" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 28, left: 8, bottom: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={INK.grid} />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: INK.muted, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey={labelKey}
              tickLine={false}
              axisLine={{ stroke: INK.axis }}
              tick={{ fill: INK.secondary, fontSize: 12 }}
              tickFormatter={(v) => truncateLabel(v)}
              width={120}
            />
            <Tooltip
              cursor={{ fill: "rgba(11,11,11,0.04)" }}
              content={<ValueTooltip labelKey={labelKey} />}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={20}>
              <LabelList
                dataKey={dataKey}
                position="right"
                style={{ fill: INK.secondary, fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function TopProductsChart({ leads }) {
  const productMap = {};
  leads.forEach((lead) => {
    if (!lead.product_name) return;
    productMap[lead.product_name] = (productMap[lead.product_name] || 0) + 1;
  });
  const productData = Object.entries(productMap)
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <RankedBarChart
      title="Top products"
      subtitle="Most-quoted products"
      data={productData}
      dataKey="count"
      labelKey="product"
      color={CITY_COLOR}
    />
  );
}

function BrandDistributionChart({ leads }) {
  const brandMap = {};
  leads.forEach((lead) => {
    const brand = lead.brand && lead.brand.trim();
    if (!brand) return;
    brandMap[brand] = (brandMap[brand] || 0) + 1;
  });
  const brandData = Object.entries(brandMap)
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <RankedBarChart
      title="Brand distribution"
      subtitle="Leads by quoted brand"
      data={brandData}
      dataKey="count"
      labelKey="brand"
      color={BRAND_COLOR}
    />
  );
}

function WinLossChart({ leads }) {
  const won = leads.filter((l) => l.status === "Won").length;
  const lost = leads.filter((l) => l.status === "Lost").length;
  const closed = won + lost;
  const rate = closed > 0 ? Math.round((won / closed) * 100) : 0;

  return (
    <ChartCard title="Win / loss" subtitle="Outcome of closed leads">
      {closed === 0 ? (
        <EmptyState label="No closed leads yet" />
      ) : (
        <div style={{ padding: "28px 4px 8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 34, fontWeight: 700, color: INK.primary }}>{rate}%</span>
            <span style={{ fontSize: 13, color: INK.muted, fontWeight: 600 }}>win rate</span>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "rgba(12,163,12,0.15)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${rate}%`,
                borderRadius: 999,
                background: GOOD_COLOR,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 24, marginTop: 18 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: INK.secondary }}>
              <span style={dotStyle(GOOD_COLOR)} />
              Won <strong style={{ color: INK.primary }}>{won}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: INK.secondary }}>
              <span style={dotStyle(CRITICAL_COLOR)} />
              Lost <strong style={{ color: INK.primary }}>{lost}</strong>
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export default function AnalyticsCharts({ leads }) {
  return (
    <div className="row g-3 mt-1">
      <StatusAndCityCharts leads={leads} />
      <MonthlyTrendChart leads={leads} />
      <TopProductsChart leads={leads} />
      <WinLossChart leads={leads} />
      <BrandDistributionChart leads={leads} />
    </div>
  );
}
