import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import OwnerWaveAnchorsOverlay from "./OwnerWaveAnchorsOverlay";
import {manualWaveDrawingEnabled} from "./Engine22FibLayersOverlay";

test("Wave Off hides every degree's manual wave lines and labels even when Fib is enabled",()=>{
  const style={showWaveLines:true,showWaveLabels:true,showExtensions:true};
  for(const degree of ["primary","intermediate","minor","minute","subminute","micro","submicro"]){
    expect(manualWaveDrawingEnabled("OFF",degree,true,style)).toBe(false);
  }
});

test("Primary stage enables Primary only, not six other manual wave layers",()=>{
  const style={showWaveLines:true,showWaveLabels:true};
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,style)).toBe(true);
  for(const degree of ["intermediate","minor","minute","subminute","micro","submicro"]){
    expect(manualWaveDrawingEnabled("PRIMARY",degree,true,style)).toBe(false);
  }
  expect(manualWaveDrawingEnabled("PRIMARY","primary",false,style)).toBe(false);
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,{showWaveLines:false,showWaveLabels:false})).toBe(false);
});

test("Off control remains selected by default on every timeframe",()=>{
  const html=renderToStaticMarkup(
    <OwnerWaveAnchorsOverlay visible={true} chart={null} priceSeries={null}
      degree="PRIMARY" stage="OFF" onStageChange={()=>{}}/>
  );
  expect(html).toContain("Wave nodes · 1/7");
  expect(html).toContain("Primary (5)");
  expect(html).toContain('aria-pressed="true"');
  expect((html.match(/<button/g)||[])).toHaveLength(2);
});

test("Primary stage marks only Primary selected",()=>{
  const html=renderToStaticMarkup(
    <OwnerWaveAnchorsOverlay visible={true} chart={null} priceSeries={null}
      degree="PRIMARY" stage="PRIMARY" onStageChange={()=>{}}/>
  );
  expect(html).toContain("Other 6 degrees hidden");
  expect(html).toContain("Primary (5)");
  expect((html.match(/aria-pressed="true"/g)||[])).toHaveLength(1);
  expect((html.match(/aria-pressed="false"/g)||[])).toHaveLength(1);
});
