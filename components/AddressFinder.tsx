"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ADDRESS_FINDER_DEBOUNCE_MS, ADDRESS_FINDER_ENDPOINT, type AdressevaelgerHit, type CanonicalAddress, parseAdressevaelgerHit } from "@/lib/address-finder";

export default function AddressFinder({ name, initialValue = "" }: { name: string; initialValue?: string }) {
  const listId = useId();
  const [query, setQuery] = useState(initialValue);
  const [selected, setSelected] = useState(initialValue);
  const [items, setItems] = useState<CanonicalAddress[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle"|"loading"|"empty"|"error">("idle");
  const request = useRef(0);
  useEffect(() => {
    if (query.trim().length < 3 || query === selected) return;
    const controller = new AbortController(); const current = ++request.current;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(ADDRESS_FINDER_ENDPOINT + encodeURIComponent(query.trim()), { signal: controller.signal });
        if (!response.ok) throw new Error("address_lookup_failed");
        const body = await response.json() as { fund?: AdressevaelgerHit[] };
        if (current !== request.current) return;
        const hits = (body.fund ?? []).map(parseAdressevaelgerHit).filter((hit): hit is CanonicalAddress => Boolean(hit));
        setItems(hits); setActive(hits.length ? 0 : -1); setStatus(hits.length ? "idle" : "empty");
      } catch (error) { if ((error as Error).name !== "AbortError" && current === request.current) setStatus("error"); }
    }, ADDRESS_FINDER_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);
  const choose = (item: CanonicalAddress) => { setQuery(item.label); setSelected(item.label); setItems([]); setStatus("idle"); };
  return <div className="adr-wrap" style={{ position: "relative" }}>
    <input role="combobox" aria-autocomplete="list" aria-expanded={items.length > 0} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      value={query} className="form-control form-control-sm" placeholder="Vejnavn husnr., postnr. by"
      onChange={(event) => { setQuery(event.target.value); setSelected(""); setItems([]); setStatus(event.target.value.trim().length >= 3 ? "loading" : "idle"); }}
      onKeyDown={(event) => { if (event.key === "ArrowDown" && items.length) { event.preventDefault(); setActive((active + 1) % items.length); } else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); setActive((active - 1 + items.length) % items.length); } else if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(items[active]); } else if (event.key === "Escape") setItems([]); }} />
    <input type="hidden" name={name} value={selected} />
    <div role="status" aria-live="polite" className="form-text field-help">{status === "loading" ? "Søger adresser…" : status === "empty" ? "Ingen adresser fundet." : status === "error" ? "Adresseopslag kunne ikke gennemføres." : query && !selected ? "Vælg et forslag for at bruge adressen." : ""}</div>
    {items.length > 0 && <div id={listId} role="listbox" style={{ position:"absolute", zIndex:20, width:"100%", background:"white", border:"1px solid #ccd", borderRadius:4 }}>
      {items.map((item,index)=><button key={`${item.providerId ?? item.label}-${index}`} id={`${listId}-${index}`} role="option" aria-selected={active===index} type="button" onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(item)} style={{display:"block",width:"100%",textAlign:"left",padding:8,background:active===index?"#eef5ff":"white",border:0}}>{item.label}</button>)}
    </div>}
  </div>;
}
