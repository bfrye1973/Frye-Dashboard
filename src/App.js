// src/App.jsx
import React from "react";
import GaugeCluster from "./components/GaugeCluster";

export default function App() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto p-4">
        <GaugeCluster />
      </div>
    </div>
  );
}
