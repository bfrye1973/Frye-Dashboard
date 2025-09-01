// src/App.jsx
import React from "react";
import GaugeCluster from "./components/GaugeCluster";
import "./index.css";

export default function App() {
  return (
    <div className="page">
      <div className="container">
        <GaugeCluster />
      </div>
    </div>
  );
}
