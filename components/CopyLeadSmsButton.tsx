"use client";

import { useState } from "react";

export default function CopyLeadSmsButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="btn btn-light btn-sm" onClick={copy} title="Kopiér besked til SMS">
      {copied ? "Kopieret" : "Kopiér SMS"}
    </button>
  );
}
