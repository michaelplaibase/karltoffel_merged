"use client";

import { useState } from "react";

const QUESTIONS = [
  { q: "Hvordan afsluttes en ordre i systemet?", opts: ["Ved at slette den", "Via knappen \"Afslut ordre\"", "Den afsluttes automatisk"], answer: 1 },
  { q: "Hvad står \"Abo. nr.\" for?", opts: ["Ordrenummer", "Abonnementsnummer", "Kundenummer"], answer: 1 },
  { q: "Hvad gør ferieplanlægningen ved kalenderen?", opts: ["Lukker de valgte uger og skubber abonnementsordrer frem", "Sletter alle ordrer", "Ingenting"], answer: 0 },
  { q: "Hvilken funktion jævner arbejdsbyrden ud over ugerne?", opts: ["Prisjustering", "Abonnementsoptimering", "Gruppebeskeder"], answer: 1 },
  { q: "Hvordan søger man i en liste (fx Kunder)?", opts: ["Man kan ikke søge", "Via søgefeltet og knappen \"Søg\"", "Kun via URL"], answer: 1 },
];

export default function QuizPage() {
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = idx >= QUESTIONS.length;

  if (!started) {
    return (
      <div className="container-1140" style={{ maxWidth: 720 }}>
        <h1 className="page-title">Fenster quiz</h1>
        <div className="card"><div className="card-body">
          <p className="muted">Test din viden om systemet med {QUESTIONS.length} spørgsmål. Du får svaret med det samme.</p>
          <button className="btn btn-primary" onClick={() => setStarted(true)}>Start quiz</button>
        </div></div>
      </div>
    );
  }

  return (
    <div className="container-1140" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Fenster quiz</h1>
      <div className="card"><div className="card-body">
        {done ? (
          <>
            <h4 className="section-title">Resultat</h4>
            <p style={{ fontSize: 18 }}>Du fik <b>{score}</b> ud af <b>{QUESTIONS.length}</b> rigtige.</p>
            <button className="btn btn-primary" onClick={() => { setStarted(false); setIdx(0); setPicked(null); setScore(0); }}>Prøv igen</button>
          </>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 12 }}>Spørgsmål {idx + 1} af {QUESTIONS.length}</div>
            <h4 className="section-title" style={{ marginTop: 6 }}>{QUESTIONS[idx].q}</h4>
            <div style={{ display: "grid", gap: 8 }}>
              {QUESTIONS[idx].opts.map((o, i) => {
                const isAnswer = i === QUESTIONS[idx].answer;
                const show = picked !== null;
                const bg = show && isAnswer ? "#e4f5ec" : show && i === picked ? "#fbe8e8" : "#fff";
                return (
                  <button key={i} className="btn btn-light" style={{ justifyContent: "flex-start", background: bg, borderColor: "var(--card-border)" }}
                    disabled={show} onClick={() => { setPicked(i); if (i === QUESTIONS[idx].answer) setScore((s) => s + 1); }}>
                    {o}{show && isAnswer ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="row-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-primary" onClick={() => { setIdx((v) => v + 1); setPicked(null); }}>
                  {idx + 1 < QUESTIONS.length ? "Næste spørgsmål" : "Se resultat"}
                </button>
              </div>
            )}
          </>
        )}
      </div></div>
    </div>
  );
}
