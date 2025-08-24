import React, { useEffect, useState } from "react";
import FerrariCluster from "./components/FerrariCluster";
import { subscribeGauges, subscribeSignals } from "./services/tos";

export default function App() {
  const [gauges, setGauges] = useState({ rpm:5200, speed:68, water:62, oil:55, fuel:73 });
  const [lights, setLights] = useState({ breakout:false, buy:false, sell:false, emaCross:false, stop:false, trail:false });

  useEffect(() => {
    const stopG = subscribeGauges(setGauges);
    const stopS = subscribeSignals(setLights);
    return () => { stopG?.(); stopS?.(); };
  }, []);

  return (
    <div style={{ padding: 14 }}>
      <FerrariCluster
        rpm={gauges.rpm}
        speed={gauges.speed}
        water={gauges.water}
        oil={gauges.oil}
        fuel={gauges.fuel}
        lights={lights}
        height={360} // tweak if you want taller/shorter
      />
      {/* your chart/journal/strategies go here */}
    </div>
  );
}
