import ReceptionistWidget from "@/components/ReceptionistWidget";

export const metadata = { title: "AI Receptionist (prototype) · Karltoffel" };

export default function AiReceptionistPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">AI Receptionist — prototype</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Demo af en AI, der altid kan &quot;tage telefonen&quot;: tjekker rigtige ordrer og kalenderbookinger i CRM&apos;et
        og svarer med tale. Ingen rigtig telefoni endnu — se README-AI-RECEPTIONIST.md i repoet for produktionsplan
        (Twilio, Whisper/Deepgram, ElevenLabs/OpenAI TTS).
      </p>
      <ReceptionistWidget />
    </div>
  );
}
