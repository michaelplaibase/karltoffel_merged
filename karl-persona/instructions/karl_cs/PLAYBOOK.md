# Karl Customer Service Loop - Playbook

Karl monitors kristian@karltoffel.dk, drafts replies as "Kristian", and gets
Michael's approval in #karltoffel-ai before sending. Gmail runs on API
(service account + domain-wide delegation), no browser.

## Trigger
A cron job pings Karl every 5 minutes. On each ping, run the loop below.

## Loop (each run)

1. **Fetch new candidates**
   ```
   cd karltoffel/karl_cs && python poll.py
   ```
   This returns `{count, candidates:[...]}` of NEW, non-bulk inbox messages
   and advances state. Each candidate has: id, threadId, from, sender_email,
   subject, date, snippet, body, already_replied.
   - If `count == 0`, stop silently. Do not post anything.
   - Dedupe by `threadId`: if several messages share a thread, handle the newest only.

2. **Classify (Karl's judgement)** - for each candidate decide: is this a real
   CUSTOMER INQUIRY (someone asking about Karltoffel's service: a job/opgave,
   pris, booking, levering, reklamation, general spørgsmål)?
   - NOT a customer inquiry: newsletters, receipts/fakturaer, bank/holding,
     calendar invites, internal/partner threads, sales pitches to Kristian,
     account activations. Skip these silently (they stay recorded in state).
   - When unsure, lean towards treating it as a customer inquiry and let
     Michael decide.

3. **CRM lookup** - look the customer up in the Karltoffel CRM
   (karltoffel-crm.vercel.app, logged-in browser session). Search at
   `/customers?q=<term>`. IMPORTANT: the search is strict, so try SEVERAL broad
   terms, not just the full string - it often returns nothing for a full
   "Firstname Lastname" or "Brand Location":
     - the sender_email
     - the surname alone
     - any location/place name mentioned in the mail (e.g. "Stilling",
       "McDonalds") - try each word separately
   When a match is found, OPEN the customer card (`/customers/<kundenr>`) and
   read the "Kommende ordrer" table - the nearest future dates are the answer
   to "when do you next come by". Report kundenr, address, att, subscription
   count, and the next 1-3 upcoming visits (date + service). Only conclude
   "ny/ukendt kunde" after the broad searches above all fail.
   (CRM has no public API yet - use the logged-in browser tab; a read endpoint
   is a planned upgrade.)

4. **Draft** - write a reply in Danish, signed "Kristian", based on the CRM
   data + info available on karltoffel.dk. Match a warm, professional
   Karltoffel tone. Do not invent prices/facts not supported by CRM or site.

5. **Post for approval** in #karltoffel-ai (C0BHPSY9U49), tagging Michael
   (<@U0AFZKGUSKA>). IMPORTANT: post via the KARL Slack account, not Win -
   only Karl (bot user U0BHJQQJF3P) is a member of that channel. Use:
   `message(action=send, accountId="karl", target="channel:C0BHPSY9U49", message=...)`.
   Format:
   ```
   Ny kundehenvendelse afventer svar, sir.
   Fra: <navn / email>
   Emne: <subject>
   CRM: <kort - kendt kunde/ordrer, eller "ny/ukendt">

   Kundens besked:
   <HELE kundens oprindelige besked, verbatim - ikke kun hovedpointer>

   Udkast:
   <hele udkastet>
   ```
   Include the candidate's Gmail `id` so the send step can reference it (keep
   it in the thread context / a note).

6. **Wait for Michael**:
   - "OK, send" (or clear approval) -> send it:
     ```
     python send_reply.py --msg-id <candidate id> --body-file <draft.txt>
     ```
     Then confirm in-channel: "Sendt til <kunde>, sir."
   - Change requests -> revise the draft and re-post for approval.

## Safety
- Never send without Michael's explicit approval.
- One draft post per customer thread per run; state prevents re-posting.
- Secrets live in karltoffel/secrets/ (gitignored). Never paste the key.
