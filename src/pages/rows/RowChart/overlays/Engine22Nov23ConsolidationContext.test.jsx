import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";

test("November 23 consolidation context is dated, research-only, and does not change source cards", () => {
  const html=renderToStaticMarkup(<Engine22MarketStructureCard
    engine22Display={{version:"engine22Display.v1",degreeOrder:["micro","submicro"],degrees:{
      micro:{label:"Micro",headline:"PRIOR HISTORIC MICRO CARD",rows:[],levels:[]},
      submicro:{label:"Submicro",headline:"PRIOR HISTORIC SUBMICRO CARD",rows:[],levels:[]}
    }}} currentWavelength={{degrees:{}}}/>);
  for (const text of ["NOV 23, 2026 ES RESEARCH SNAPSHOT",
    "DIRECTION UNRESOLVED","7,272.25","7,250","7,300","7,313.25","7,240",
    "Micro W1 UP","Submicro","NOT live prices","Engine 6 authority",
    "PRIOR HISTORIC MICRO CARD","PRIOR HISTORIC SUBMICRO CARD"]) {
      expect(html.toUpperCase()).toContain(text.toUpperCase());
    }
  expect(html).toContain('data-testid="engine22-nov23-consolidation-context"');
  expect(html).toContain("No new W2 Fibonacci ladder");
});
