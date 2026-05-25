async function onListenAI() {
  setAiBusy(true);
  setAiError("");
  setAiText("");

  try {
    const snap = await fetch(
      `${CORE_BASE}/api/v1/dashboard-snapshot?symbol=ES&includeContext=1&t=${Date.now()}`,
      { cache: "no-store" }
    ).then((r) => r.json());

    const ai =
      snap?.strategies?.["intraday_scalp@10m"]?.aiTradeCopilot || null;

    if (!ai?.ok) {
      throw new Error("AI Trade Copilot not available in ES snapshot.");
    }

    const reasoning = ai.aiReasoning || {};

    const text = [
      `AI Trade Copilot: ${ai.headline || "No headline."}`,
      `Bias: ${ai.bias || "Unknown"}.`,
      `Action: ${ai.action || "Unknown"}.`,
      `Confidence: ${ai.confidence || "Unknown"}.`,
      `Should chase: ${ai.shouldChase ? "YES" : "NO"}.`,
      reasoning.read ? `Read: ${reasoning.read}.` : "",
      reasoning.bestScenario ? `Best scenario: ${reasoning.bestScenario}.` : "",
      reasoning.dangerScenario ? `Danger scenario: ${reasoning.dangerScenario}.` : "",
      Array.isArray(reasoning.confirmationNeeded) && reasoning.confirmationNeeded.length
        ? `Confirmation needed: ${reasoning.confirmationNeeded.join(", ")}.`
        : "",
      Array.isArray(reasoning.avoid) && reasoning.avoid.length
        ? `Avoid: ${reasoning.avoid.join(". ")}.`
        : "",
      reasoning.invalidationRead ? `Invalidation: ${reasoning.invalidationRead}.` : "",
      Array.isArray(ai.warnings) && ai.warnings.length
        ? `Warnings: ${ai.warnings.join(". ")}.`
        : "",
      ai.summary || "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setAiText(text);

    try {
      if (window.speechSynthesis) {
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
