import { chromium } from "playwright";

const BASE =
  process.env.ENGINE29_FRONTEND_BASE ||
  "https://frye-dashboard.onrender.com";
const API =
  process.env.ENGINE29_BACKEND_URL ||
  "https://frye-market-backend-1.onrender.com/api/v1/engine29/cross-market-stress";

function clean(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expectedMoveLabel(parent) {
  if (parent?.active !== true) return "NO ACTIVE MOVE";
  if (parent?.direction === "UP") return "UPSIDE MOVE ACTIVE";
  if (parent?.direction === "DOWN") return "DOWNSIDE MOVE ACTIVE";
  return "NO ACTIVE MOVE";
}

function segment(text, needle, radius = 360) {
  const normalized = String(text || "");
  const i = normalized.indexOf(needle);
  if (i < 0) return null;
  return normalized.slice(Math.max(0, i - 80), Math.min(normalized.length, i + needle.length + radius));
}

async function bodyText(page) {
  return await page.locator("body").innerText();
}

async function assertContains(name, text, needle) {
  if (!String(text).includes(needle)) {
    throw new Error(`${name}: missing expected text: ${needle}`);
  }
}

async function openAndCapture(page, url, marker, screenshotPath) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByText(marker, { exact: false }).first().waitFor({
    state: "visible",
    timeout: 120000,
  });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return bodyText(page);
}

const apiResponse = await fetch(API, { cache: "no-store" });
if (!apiResponse.ok) {
  throw new Error(`backend API failed: HTTP ${apiResponse.status}`);
}
const apiJson = await apiResponse.json();
const canonical = apiJson?.data || apiJson;
const parent = canonical?.marketCharacter?.move?.parent || null;
const character = canonical?.marketCharacter?.move?.character || null;
const liveCondition = canonical?.marketCharacter?.move?.liveCondition || null;
const liquidity = canonical?.marketCharacter?.liquidity || null;
const trap = canonical?.marketCharacter?.trap || null;

const expectedMove = expectedMoveLabel(parent);

console.log(
  "CANONICAL_API " +
    JSON.stringify({
      timestamp: canonical?.timestamp ?? null,
      dataDegraded: canonical?.dataDegraded === true,
      parent: {
        active: parent?.active === true,
        direction: parent?.direction ?? null,
        expectedDisplay: expectedMove,
      },
      character: {
        type: character?.type ?? null,
        squeezeActive: character?.squeeze?.active === true,
        squeezeDirection: character?.squeeze?.direction ?? null,
        broadState: character?.broadConfirmation?.state ?? null,
        targetDirection:
          character?.broadConfirmation?.targetDirection ?? null,
      },
      liveCondition: {
        state: liveCondition?.state ?? null,
        direction: liveCondition?.direction ?? null,
        contextVsParent: liveCondition?.contextVsParent ?? null,
      },
      oneHour: canonical?.tacticalState ?? null,
      fastTactical: canonical?.fastTacticalState ?? null,
      liquidity: liquidity?.state ?? null,
      trap: trap?.state ?? null,
    })
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1200 },
});
const page = await context.newPage();

try {
  const homeText = await openAndCapture(
    page,
    BASE,
    "ENGINE 29 — MARKET CHARACTER",
    "engine29-home.png"
  );

  const homeChecks = {
    parentMove: homeText.includes("ES Parent MOVE"),
    expectedMove: homeText.includes(expectedMove),
    character: homeText.includes("MOVE Authority"),
    liveCondition: homeText.includes("10m Live Condition"),
    fastTactical: homeText.includes("30m Fast Shift"),
    oneHour: homeText.includes("1H Current Pressure"),
    liquidity: homeText.includes("Liquidity"),
    trap: homeText.includes("Trap Detection"),
    degraded:
      canonical?.dataDegraded !== true ||
      homeText.includes("DATA DEGRADED"),
  };

  console.log(
    "HOME_OUTPUT " +
      JSON.stringify({
        checks: homeChecks,
        markerSegment: segment(homeText, "ENGINE 29 — MARKET CHARACTER", 1600),
        move: segment(homeText, "ES Parent MOVE"),
        character: segment(homeText, "MOVE Authority"),
        live: segment(homeText, "10m Live Condition"),
        liquidity: segment(homeText, "Liquidity"),
        trap: segment(homeText, "Trap Detection"),
      })
  );

  const fullText = await openAndCapture(
    page,
    BASE + "/engine29-full",
    "ENGINE 29 — MARKET CHARACTER",
    "engine29-full.png"
  );

  const fullChecks = {
    parentMove: fullText.includes("ES Parent MOVE"),
    expectedMove: fullText.includes(expectedMove),
    character: fullText.includes("MOVE Authority"),
    liveCondition: fullText.includes("10m Live Condition"),
    fastTactical: fullText.includes("30m Fast Shift"),
    oneHour: fullText.includes("1H Current Pressure"),
    liquidity: fullText.includes("Liquidity"),
    trap: fullText.includes("Trap Detection"),
    degraded:
      canonical?.dataDegraded !== true ||
      fullText.includes("DATA DEGRADED"),
  };

  console.log(
    "FULL_OUTPUT " +
      JSON.stringify({
        checks: fullChecks,
        markerSegment: segment(fullText, "ENGINE 29 — MARKET CHARACTER", 1600),
        move: segment(fullText, "ES Parent MOVE"),
        character: segment(fullText, "MOVE Authority"),
        live: segment(fullText, "10m Live Condition"),
        liquidity: segment(fullText, "Liquidity"),
        trap: segment(fullText, "Trap Detection"),
      })
  );

  await page.goto(BASE + "/chart", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(8000);

  await page.getByText("Indicators ▾", { exact: true }).click();
  const overlayLabel = page.getByText("Cross-Market Stress Window", {
    exact: true,
  });
  await overlayLabel.waitFor({ state: "visible", timeout: 120000 });
  const checkbox = overlayLabel.locator(
    "xpath=preceding::input[@type='checkbox'][1]"
  );
  await checkbox.check();

  await page
    .getByText("Engine 29 — Cross-Market Stress", { exact: false })
    .last()
    .waitFor({ state: "visible", timeout: 120000 });
  await page.waitForTimeout(12000);

  const chartText = await bodyText(page);
  await page.screenshot({
    path: "engine29-chart-overlay.png",
    fullPage: true,
  });

  const chartChecks = {
    parentMove: chartText.includes("ES Parent MOVE"),
    expectedMove: chartText.includes(expectedMove),
    character:
      chartText.includes("MOVE v2 Authority") &&
      chartText.includes("Character"),
    liveCondition: chartText.includes("Live condition"),
    fastTactical: chartText.includes("30m Fast Shift"),
    oneHour: chartText.includes("1H Intraday"),
    liquidity:
      chartText.includes("Liquidity") &&
      chartText.includes(clean(liquidity?.state)),
    trap:
      chartText.includes("Trap") &&
      chartText.includes(clean(trap?.state)),
    degraded:
      canonical?.dataDegraded !== true ||
      chartText.includes("DATA DEGRADED"),
  };

  console.log(
    "CHART_OUTPUT " +
      JSON.stringify({
        checks: chartChecks,
        markerSegment: segment(chartText, "Engine 29 — Cross-Market Stress", 2000),
        move: segment(chartText, "ES Parent MOVE"),
        authority: segment(chartText, "MOVE v2 Authority"),
      })
  );

  const parity = {
    home: homeChecks,
    full: fullChecks,
    chartOverlay: chartChecks,
  };

  const failed = Object.entries(parity).flatMap(([surface, checks]) =>
    Object.entries(checks)
      .filter(([, ok]) => ok !== true)
      .map(([check]) => `${surface}:${check}`)
  );

  console.log(
    "PRODUCTION_PARITY_SUMMARY " +
      JSON.stringify({
        canonicalTimestamp: canonical?.timestamp ?? null,
        parentDirection: parent?.direction ?? null,
        expectedMove,
        failed,
        parity,
      })
  );

  if (failed.length) {
    throw new Error(
      "PRODUCTION_PARITY_INCOMPLETE " + JSON.stringify(failed)
    );
  }

  console.log(
    "PRODUCTION_PARITY_PASS " +
      JSON.stringify({
        canonicalTimestamp: canonical?.timestamp ?? null,
        parentDirection: parent?.direction ?? null,
        expectedMove,
        home: true,
        full: true,
        chartOverlay: true,
      })
  );
} finally {
  await browser.close();
}
