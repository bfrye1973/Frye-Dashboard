import React from "react";

// === Mini Gauge Component ===
function MiniGauge({ label, valueText }) {
  return (
    <div style={{
      width: 90,
      height: 90,
      borderRadius: "50%",
      background: "radial-gradient(circle at 30% 30%, #1a1a1a, #000)",
      border: "4px solid #555",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
      color: "#e5e7eb",
      fontSize: 12,
      fontWeight: "bold",
      boxShadow: "inset 0 0 12px #000, 0 0 8px #111"
    }}>
      <div style={{ fontSize: 10, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{valueText}</div>
    </div>
  );
}

// === Big Gauge Component (tach/speed) ===
function BigGauge({
  size = 300,
  face = "yellow",
  label = "RPM",
  numerals = [],
  numeralsColor = "#000",
  needleDeg = 0,
  redPerimeter = false,
}) {
  const faceColor =
    face === "yellow" ? "#facc15" :
    face === "red" ? "#dc2626" : "#111";
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: faceColor,
      border: "16px solid #111",
      position: "relative",
      boxShadow: "inset 0 0 20px #000, 0 0 18px #000",
    }}>
      {/* Outer red perimeter ring */}
      {redPerimeter && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: "18px solid #b91c1c",
          borderRadius: "50%",
          pointerEvents: "none"
        }}/>
      )}

      {/* Numerals */}
      {numerals.map((n, i) => {
        const angle = (i / numerals.length) * 270 - 225;
        const rad = (angle * Math.PI) / 180;
        const r = size * 0.38;
        const x = size/2 + r * Math.cos(rad);
        const y = size/2 + r * Math.sin(rad);
        return (
          <div key={i} style={{
            position: "absolute",
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            fontSize: 18,
            fontWeight: "bold",
            color: numeralsColor,
            textShadow: "0 0 3px #000"
          }}>{n}</div>
        );
      })}

      {/* Needle */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size*0.45,
        height: 3,
        background: "#fff",
        transformOrigin: "0% 50%",
        transform: `rotate(${needleDeg}deg) translateX(-50%)`,
        boxShadow: "0 0 4px #000"
      }}/>

      {/* Center hub */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#111",
        border: "3px solid #888",
        transform: "translate(-50%, -50%)"
      }}/>

      {/* Label */}
      <div style={{
        position: "absolute",
        bottom: 20,
        width: "100%",
        textAlign: "center",
        fontSize: 16,
        fontWeight: "bold",
        color: numeralsColor,
      }}>{label}</div>
    </div>
  );
}

// === Engine Light (simple demo) ===
function EngineLight({ label, color="gray", on=false }) {
  return (
    <div style={{
      width: 60,
      height: 40,
      margin: "0 6px",
      borderRadius: 6,
      background: on ? color : "#222",
      color: on ? "#fff" : "#555",
      fontSize: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold",
      boxShadow: on ? `0 0 10px ${color}` : "inset 0 0 4px #000"
    }}>
      {label}
    </div>
  );
}

// === Full Cluster ===
export default function FerrariClusterFull() {
  const tachLabels = ["0","1","2","3","4","5","6","7","8","9","10"];
  const speedLabels = ["0","20","40","60","80","100","120","140","160"];

  return (
    <div style={{
      background: "repeating-linear-gradient(45deg, #222 0, #222 4px, #111 4px, #111 8px)",
      padding: 30,
      borderRadius: 20,
      boxShadow: "0 0 25px #000 inset",
    }}>
      {/* Branding text in bezel area */}
      <div style={{
        textAlign: "center",
        marginBottom: 8,
        fontSize: 22,
        fontWeight: "bold",
        color: "#E21D1D",
        textShadow: "0 0 6px #fff"
      }}>REDLINE TRADING</div>

      <div style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center"
      }}>
        {/* Left mini gauges */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
          <MiniGauge label="WATER" valueText="210°F" />
          <MiniGauge label="OIL" valueText="70 PSI" />
          <MiniGauge label="FUEL" valueText="3/4" />
        </div>

        {/* Tach + Speed side by side */}
        <div style={{ display:"flex", gap:40 }}>
          <BigGauge
            size={300}
            face="yellow"
            label="RPM"
            numerals={tachLabels}
            numeralsColor="#000"
            needleDeg={120}   // ~3.5-4k
            redPerimeter
          />
          <BigGauge
            size={260}
            face="red"
            label="SPEED"
            numerals={speedLabels}
            numeralsColor="#fff"
            needleDeg={-20}   // ~40 mph
            redPerimeter
          />
        </div>
      </div>

      {/* Bottom branding */}
      <div style={{
        textAlign: "center",
        marginTop: 10,
        fontSize: 16,
        fontWeight: "bold",
        color: "#E21D1D",
        textShadow: "0 0 6px #fff"
      }}>POWERED BY AI</div>

      {/* Engine lights row */}
      <div style={{
        marginTop: 20,
        display:"flex",
        justifyContent:"center"
      }}>
        <EngineLight label="BREAKOUT" color="green" on={true}/>
        <EngineLight label="SELL" color="red" on={true}/>
        <EngineLight label="TURBO" color="orange" on={false}/>
        <EngineLight label="VOLUME" color="blue" on={false}/>
      </div>
    </div>
  );
}
