import React from "react";
import Chart from "react-apexcharts";

export default function App() {
  const chartOptions = {
    chart: { id: "stock-chart", type: "candlestick" },
    title: { text: "Ferrari Dashboard", align: "left" },
    xaxis: { type: "datetime" },
    yaxis: { tooltip: { enabled: true } },
  };

  const chartSeries = [{
    data: [
      { x: new Date("2023-08-01"), y: [445, 455, 442, 453] },
      { x: new Date("2023-08-02"), y: [453, 460, 450, 458] },
      { x: new Date("2023-08-03"), y: [458, 465, 456, 462] },
      { x: new Date("2023-08-04"), y: [462, 468, 460, 465] }
    ]
  }];

  return (
    <div style={{ padding: 20, backgroundColor: 'black', color: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: '#f00' }}>Ferrari Dashboard</h1>
      <Chart options={chartOptions} series={chartSeries} type="candlestick" height={400} />
    </div>
  );
}
