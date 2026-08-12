"use client";

// AI Receptionist demo widget — client-side voice UI on top of the real
// answerReceptionistQuery server action (queries live Prisma CRM data).
// Speech-to-text and text-to-speech both use the browser's native Web Speech
// API (SpeechRecognition / SpeechSynthesis) — no external API keys needed for
// this prototype. See README-AI-RECEPTIONIST.md for the production upgrade
// path (Whisper/Deepgram STT, ElevenLabs/OpenAI TTS, Twilio telephony).
import { useEffect, useRef, useState } from "react";
import { answerReceptionistQuery, type ReceptionistAnswer } from "@/app/actions/receptionist";

type Turn = { role: "customer" | "ai"; text: string };

const QUICK_QUESTIONS = [
  { label: "Hvornår kommer i? (DA)", customer: "", question: "Hvornår kommer i og gør rent hos mig?" },
  { label: "Ordrestatus (DA)", customer: "", question: "Kan du tjekke status på min ordre?" },
  { label: "Pris (DA)", customer: "", question: "Hvad koster det næste besøg?" },
  { label: "Order status (EN)", customer: "", question: "Can you check my order status?" },
  { label: "Next appointment (EN)", customer: "", question: "When is my next appointment?" },
];

export default function ReceptionistWidget() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Warm up SpeechSynthesis voice list (Chrome loads it async).
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setVoicesReady(window.speechSynthesis.getVoices().length > 0);
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  function speak(text: string, lang: "da" | "en") {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "da" ? "da-DK" : "en-US";
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith(lang === "da" ? "da" : "en")) ?? voices[0];
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  }

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text || busy) return;
    setBusy(true);
    setTurns((t) => [...t, { role: "customer", text }]);
    setQuestion("");
    try {
      const res: ReceptionistAnswer = await answerReceptionistQuery(customerQuery, text);
      setTurns((t) => [...t, { role: "ai", text: res.text }]);
      speak(res.text, res.lang);
    } catch (e) {
      const msg = "Der skete en fejl — prøv igen.";
      setTurns((t) => [...t, { role: "ai", text: msg }]);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Denne browser understøtter ikke tale-til-tekst (Web Speech API). Brug Chrome/Edge, eller skriv i stedet.");
      return;
    }
    const recog = new SR();
    recog.lang = "da-DK";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuestion(transcript);
      setListening(false);
      ask(transcript);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recognitionRef.current = recog;
    setListening(true);
    recog.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <div className="card">
      <div className="card-body">
        <h4 className="section-title">🎙️ AI Receptionist (prototype)</h4>
        <p className="muted" style={{ marginBottom: 16 }}>
          Simulerer en AI, der altid kan &quot;tage telefonen&quot;: slår rigtige kunder/ordrer op i CRM&apos;et og svarer
          med tale (browser TTS). Ingen rigtig telefoni i denne prototype — se README-AI-RECEPTIONIST.md for produktionsvej.
        </p>

        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          <label className="muted" style={{ fontSize: 13 }}>
            Kunde (navn, telefon eller e-mail) — simulerer opkalder-ID
          </label>
          <input
            className="input"
            placeholder="fx Anna Jensen, 12345678, eller anna@example.com"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              className="btn btn-sm btn-outline"
              disabled={busy}
              onClick={() => ask(q.question)}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            minHeight: 160,
            maxHeight: 320,
            overflowY: "auto",
            padding: 12,
            marginBottom: 12,
            background: "var(--surface-2, #f8f9fa)",
          }}
        >
          {turns.length === 0 && <p className="muted" style={{ margin: 0 }}>Stil et spørgsmål — fx &quot;Hvornår kommer i?&quot;</p>}
          {turns.map((t, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                textAlign: t.role === "customer" ? "right" : "left",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 12,
                  background: t.role === "customer" ? "var(--accent, #0d6efd)" : "#fff",
                  color: t.role === "customer" ? "#fff" : "inherit",
                  border: t.role === "ai" ? "1px solid var(--border)" : "none",
                  maxWidth: "80%",
                }}
              >
                {t.role === "ai" ? "🤖 " : "🙋 "}
                {t.text}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Skriv spørgsmål på dansk eller engelsk…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            disabled={busy}
          />
          <button type="button" className="btn" onClick={() => ask()} disabled={busy}>
            Send
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={listening ? stopListening : startListening}
            disabled={busy}
            title="Tale-input (Web Speech API — Chrome/Edge)"
          >
            {listening ? "⏹ Stop" : "🎤 Tal"}
          </button>
        </div>
        {!voicesReady && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Bemærk: browserens tale-stemmer indlæses — første svar kan komme uden tale.
          </p>
        )}
      </div>
    </div>
  );
}
