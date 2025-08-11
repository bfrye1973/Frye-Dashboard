// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SanityText from "./pages/SanityText";
import Platform from "./pages/Platform";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* default → platform */}
        <Route path="/" element={<Navigate to="/platform" replace />} />

        {/* platform (your chart) */}
        <Route path="/platform" element={<Platform />} />

        {/* sanity check page */}
        <Route path="/sanity" element={<SanityText />} />

        {/* catch-all → platform */}
        <Route path="*" element={<Navigate to="/platform" replace />} />
      </Routes>
    </Router>
  );
}
