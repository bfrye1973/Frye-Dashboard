async function onListenAI() {
  setAiBusy(true);
  setAiError("");
  setAiText("");

  try {
    const response = await fetch(
      `${CORE_BASE}/api/v1/dashboard-snapshot?symbol=ES&includeContext=1&t=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Dashboard snapshot failed: ${response.status}`);
    }

    const snap = await response.json();

    const ai =
      snap?.strategies?.["intraday_scalp@10m"]?.aiTradeCopilot || null;

    if (!ai || ai.ok !== true) {
      throw new Error("AI Trade Copilot not available in ES snapshot.");
    }

    const reasoning = ai.aiReasoning || {};
    const confirmationNeeded = Array.isArray(reasoning.confirmationNeeded)
      ? reasoning.confirmationNeeded
      : [];
    const avoid = Array.isArray(reasoning.avoid) ? reasoning.avoid : [];
    const warnings = Array.isArray(ai.warnings) ? ai.warnings : [];

    const text = [
      `AI Trade Copilot: ${ai.headline || "No headline available."}`,
      `Price: ${Number.isFinite(Number(ai.price)) ? ai.price : "Unknown"}.`,
      `Bias: ${ai.bias || "Unknown"}.`,
      `Action: ${ai.action || "Unknown"}.`,
      `Confidence: ${ai.confidence || "Unknown"}.`,
      `Should chase: ${ai.shouldChase ? "YES" : "NO"}.`,

      reasoning.read ? `Read: ${reasoning.read}.` : "",
      reasoning.bestScenario
        ? `Best scenario: ${reasoning.bestScenario}.`
        : "",
      reasoning.dangerScenario
        ? `Danger scenario: ${reasoning.dangerScenario}.`
        : "",

      confirmationNeeded.length
        ? `Confirmation needed: ${confirmationNeeded.join(", ")}.`
        : "",

      avoid.length ? `Avoid: ${avoid.join(". ")}.` : "",

      reasoning.invalidationRead
        ? `Invalidation: ${reasoning.invalidationRead}.`
        : "",

      reasoning.confidenceNote
        ? `Confidence note: ${reasoning.confidenceNote}.`
        : "",

      warnings.length ? `Warnings: ${warnings.join(". ")}.` : "",

      ai.summary ? `Summary: ${ai.summary}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setAiText(text);

    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1;
        utter.pitch = 1;
        utter.volume = 1;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    } catch (speechErr) {
      console.warn("Speech synthesis failed:", speechErr);
    }
  } catch (e) {
    setAiError(String(e?.message || e));
  } finally {
    setAiBusy(false);
  }
}
