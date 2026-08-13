import { createHash } from "node:crypto";

export type Coordinate = readonly [number, number];
export type GeocodeStatus = "verified" | "unverified_address";
export type GeocodeResult = { status: GeocodeStatus; normalizedAddress: string; coordinate: Coordinate | null; provider: "nominatim" | "dawa" };
export type MatrixPoint = { index: number; lat: number; lon: number; kind: "employee_home" | "job"; stableRef: string; stableRefs: string[] };
export type TravelMatrix = { addresses: string[]; durations: number[][]; provider: string; capturedAt: string };
export type Calendar2UnplannedReason = "unassigned" | "unverified_address" | "unverified_route" | "fixed_weekday_unavailable" | "overflow" | "invalid_duration" | "exceeds_daily_capacity";

export type Calendar2Job = {
  id: number; contactId: number; customer: string; address: string; postal: string; category: string;
  durationMin: number; source: string; fixedWeekdays?: number[]; fixedEmployeeId?: number;
  /** Optional source-task detail. Calendar2 keeps this read-only identity while
   * a long visit is represented by several preview-only job segments. */
  sourceTasks?: { id: string; durationMin: number | null }[];
  previewSegment?: { sourceJobId: number; sourceTaskId: string; index: number; count: number; minutes: number; originalSourceWeek: string; reason: "multi_day_continuation" | "cascade_shift" };
};
export type Calendar2Employee = {
  id: number; name: string; homeAddress: string | null; workStartMin: number; workEndMin: number;
  flexMin: number; workdays: number[];
};
export type TravelLeg = { from: string; to: string; minutes: number; kind: "home_to_stop" | "interstop" | "return_home" };
export type Calendar2Stop = { job: Calendar2Job; startMin: number; endMin: number; driveMin: number; audit: { fixedWeekdays: number[] | null; matrixFromIndex: number; matrixToIndex: number; sourceWeekdayOverridden: boolean; overrideReason: "invalid_source_weekday_reassigned" | "capacity_overflow_rebalanced" | null; sourceJobId?: number; sourceTaskId?: string; segmentIndex?: number; segmentCount?: number; segmentMinutes?: number; originalSourceWeek?: string; previewWeek?: string; cascadeReason?: "multi_day_continuation" | "cascade_shift" } };
export type Calendar2Day = { employeeId: number; weekday: number; stops: Calendar2Stop[]; travelLegs: TravelLeg[]; driveMin: number; serviceMin: number; returnHomeMin: number };
export type Calendar2Unplanned = { job: Calendar2Job; reason: Calendar2UnplannedReason };
export type Calendar2Plan = {
  weekMonday: string; days: Calendar2Day[]; unplanned: Calendar2Unplanned[];
  audit: { optimizationContract: "deterministic-nearest-feasible-not-global-optimum"; matrixProvider: string; matrixCapturedAt: string; matrixAddresses: string[]; matrixDurations: number[][] };
};
export type Calendar2Series = {
  seriesId: number;
  sourceStartWeek: string;
  occurrences: { sourceWeek: string; job: Calendar2Job }[];
};
export type Calendar2SeriesReason = Calendar2UnplannedReason | "capacity_shifted_to_earliest_day" | "capacity_deferred_outside_display_horizon" | null;
export type Calendar2HorizonResult = {
  weeks: { weekMonday: string; plan: Calendar2Plan }[];
  placements: { seriesId: number; sourceWeek: string; previewWeek: string; jobId: number }[];
  outOfHorizon: { seriesId: number; sourceWeek: string; previewWeek: string; jobId: number; segments: { sourceTaskId: string; minutes: number; weekday: number }[] }[];
  seriesAudit: { seriesId: number; sourceStartWeek: string; previewStartWeek: string | null; reason: Calendar2SeriesReason }[];
  unplanned: { seriesId: number; sourceWeek: string; job: Calendar2Job; reason: Calendar2UnplannedReason; rejectedTasks: { sourceTaskId: string; effectiveMinutes: number }[] }[];
};

export type Calendar2HorizonOptions = { blockedWeeks?: ReadonlySet<string> };

type RoutingOptions = { fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; timeoutMs?: number; geocodeConcurrency?: number };
const USER_AGENT = "Karltoffel-Calendar2-RoutePlanner/1.0 (+https://crm.karltoffel.dk; operations@karltoffel.dk)";
export const normalizeDanishAddress = (address: string) => address.trim().replace(/^[.,;:\s]+/, "").replace(/\bSkt\./gi, "Sankt").replace(/\bG\.(?=\s|\d)/gi, "Gade").replace(/\s+/g, " ");
const normalized = normalizeDanishAddress;

function addressIdentity(address: string) {
  const match = normalized(address).match(/\b(\d+[A-Za-z]?)\s*,?\s*(\d{4})\b/);
  return match ? { house: match[1].toLocaleLowerCase("da-DK"), postcode: match[2] } : null;
}

export function calendar2MatrixStableRefs(addresses: string[], refs: { address: string; stableRef: string }[]): string[][] {
  const refsByAddress = new Map<string, string[]>();
  for (const ref of refs) {
    const key = normalized(ref.address);
    const values = refsByAddress.get(key) ?? [];
    if (!values.includes(ref.stableRef)) values.push(ref.stableRef);
    refsByAddress.set(key, values);
  }
  return addresses.map((address) => refsByAddress.get(normalized(address)) ?? []);
}

function canonicalMatrixValue(value: number): number | "unreachable" {
  return Number.isFinite(value) ? value : "unreachable";
}

export function calendar2MatrixAuditHash(input: {
  version: string; provider: string; matrixPoints: MatrixPoint[]; matrixDurations: number[][]; timestamp: string;
}): string {
  // timestamp er bevidst ikke del af bindingen, så samme input og matrix giver samme hash.
  const canonical = JSON.stringify({
    version: input.version,
    provider: input.provider,
    matrixPoints: input.matrixPoints,
    matrixDurations: input.matrixDurations.map((row) => row.map(canonicalMatrixValue)),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function createCalendar2Routing(options: RoutingOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const geocodeConcurrency = Math.max(1, Math.min(8, Math.floor(options.geocodeConcurrency ?? 3)));
  const geocodeCache = new Map<string, Promise<GeocodeResult>>();
  const matrixCache = new Map<string, Promise<{ matrix: TravelMatrix | null; geocodes: GeocodeResult[] }>>();
  let lastGeocodeAt = -Infinity;

  const geocode = (rawAddress: string): Promise<GeocodeResult> => {
    const address = normalized(rawAddress);
    const key = address.toLocaleLowerCase("da-DK");
    const cached = geocodeCache.get(key);
    if (cached) return cached;
    const pending = (async (): Promise<GeocodeResult> => {
      if (!address) return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "dawa" };

      // All CRM addresses are Danish. Resolve structured Danish addresses with
      // DAWA first: it has no Nominatim-style global one-request-per-second
      // throttle and verifies the exact house number + postcode. Nominatim is
      // retained only for unstructured inputs that DAWA cannot identify.
      const identity = addressIdentity(address);
      if (identity) {
        for (let attempt = 0; attempt < 2; attempt++) try {
          const dawaUrl = new URL("https://api.dataforsyningen.dk/adresser");
          dawaUrl.searchParams.set("q", address);
          dawaUrl.searchParams.set("struktur", "mini");
          dawaUrl.searchParams.set("per_side", "1");
          const response = await fetcher(dawaUrl, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
          if (!response.ok) throw new Error(`dawa_http_${response.status}`);
          const dawa = await response.json() as Array<{ vejnavn?: string; husnr?: string; postnr?: string; postnrnavn?: string; x?: number; y?: number }>;
          const hit = dawa[0];
          if (!hit) {
            const washUrl = new URL("https://api.dataforsyningen.dk/datavask/adresser");
            washUrl.searchParams.set("betegnelse", address);
            const washResponse = await fetcher(washUrl, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
            if (!washResponse.ok) throw new Error(`dawa_wash_http_${washResponse.status}`);
            const wash = await washResponse.json() as { resultater?: Array<{ adresse?: { href?: string; husnr?: string; postnr?: string } }> };
            const result = wash.resultater?.length === 1 ? wash.resultater[0]?.adresse : null;
            const href = result?.href ? new URL(result.href) : null;
            if (result?.husnr?.toLocaleLowerCase("da-DK") !== identity.house || result?.postnr !== identity.postcode || href?.hostname !== "api.dataforsyningen.dk") {
              return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "dawa" };
            }
            const canonicalResponse = await fetcher(href, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
            if (!canonicalResponse.ok) throw new Error(`dawa_canonical_http_${canonicalResponse.status}`);
            const canonical = await canonicalResponse.json() as { husnr?: string; postnr?: string; x?: number; y?: number };
            const lat = Number(canonical.y); const lon = Number(canonical.x);
            if (canonical.husnr?.toLocaleLowerCase("da-DK") !== identity.house || canonical.postnr !== identity.postcode || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 54.4 || lat > 57.9 || lon < 7.5 || lon > 15.3) {
              return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "dawa" };
            }
            return { status: "verified", normalizedAddress: address, coordinate: [lat, lon], provider: "dawa" };
          }
          const hitHouse = hit.husnr?.toLocaleLowerCase("da-DK");
          const lat = Number(hit.y); const lon = Number(hit.x);
          if (hitHouse !== identity.house || hit.postnr !== identity.postcode || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 54.4 || lat > 57.9 || lon < 7.5 || lon > 15.3) {
            return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "dawa" };
          }
          return { status: "verified", normalizedAddress: address, coordinate: [lat, lon], provider: "dawa" };
        } catch {
          if (attempt === 1) return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "dawa" };
        }
      }

      for (let attempt = 0; attempt < 2; attempt++) try {
        const wait = Math.max(0, 1_000 - (now() - lastGeocodeAt));
        if (wait) await sleep(wait);
        lastGeocodeAt = now();
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", `${address}, Danmark`);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", "dk");
        url.searchParams.set("addressdetails", "1");
        const response = await fetcher(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
        if (!response.ok) throw new Error(`geocode_http_${response.status}`);
        const body = await response.json() as Array<{ lat?: string; lon?: string }>;
        const lat = Number(body[0]?.lat); const lon = Number(body[0]?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 54.4 && lat <= 57.9 && lon >= 7.5 && lon <= 15.3) {
          return { status: "verified", normalizedAddress: address, coordinate: [lat, lon], provider: "nominatim" };
        }
        return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "nominatim" };
      } catch {
        if (attempt === 1) return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "nominatim" };
      }
      return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "nominatim" };
    })();
    geocodeCache.set(key, pending);
    pending.then((result) => { if (result.status !== "verified") geocodeCache.delete(key); });
    return pending;
  };

  const buildMatrix = (rawAddresses: string[]) => {
    const addresses = [...new Set(rawAddresses.map(normalized))];
    const key = addresses.map((a) => a.toLocaleLowerCase("da-DK")).join("\n");
    const cached = matrixCache.get(key);
    if (cached) return cached;
    const pending = (async () => {
      const geocodes: GeocodeResult[] = [];
      for (const address of addresses) geocodes.push(await geocode(address));
      const verified = geocodes.filter((result): result is GeocodeResult & { coordinate: Coordinate } => result.status === "verified" && Boolean(result.coordinate));
      const verifiedAddresses = verified.map((result) => result.normalizedAddress);
      if (!verified.length) return { matrix: null, geocodes };
      try {
        const coords = verified.map((result) => `${result.coordinate[1]},${result.coordinate[0]}`).join(";");
        const url = new URL(`https://router.project-osrm.org/table/v1/driving/${coords}`);
        url.searchParams.set("annotations", "duration");
        const response = await fetcher(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
        if (!response.ok) throw new Error(`matrix_http_${response.status}`);
        const body = await response.json() as { code?: string; durations?: Array<Array<number | null>> };
        if (body.code !== "Ok" || !body.durations || body.durations.length !== verified.length || body.durations.some((row) => row.length !== verified.length)) throw new Error("invalid_matrix");
        const durations = body.durations.map((row) => row.map((seconds) => seconds == null || !Number.isFinite(seconds) ? Number.POSITIVE_INFINITY : Math.ceil(Number(seconds) / 60)));
        const partial = durations.some((row) => row.some((minutes) => !Number.isFinite(minutes)));
        return { matrix: { addresses: verifiedAddresses, durations, provider: partial ? "osrm-table-partial" : "osrm-table", capturedAt: new Date(now()).toISOString() }, geocodes };
      } catch {
        return { matrix: null, geocodes };
      }
    })();
    matrixCache.set(key, pending);
    pending.then((result) => { if (!result.matrix) matrixCache.delete(key); });
    return pending;
  };

  const buildIsolatedMatrix = async (groups: string[][], rawAddresses = groups.flat()) => {
    const addresses = [...new Set(rawAddresses.map(normalized))];
    const geocodes = new Array<GeocodeResult>(addresses.length);
    let nextAddress = 0;
    await Promise.all(Array.from({ length: Math.min(geocodeConcurrency, addresses.length) }, async () => {
      while (nextAddress < addresses.length) {
        const index = nextAddress++;
        geocodes[index] = await geocode(addresses[index]);
      }
    }));
    const verifiedAddresses = geocodes.filter((result) => result.status === "verified").map((result) => result.normalizedAddress);
    if (!verifiedAddresses.length) return { matrix: null, geocodes };
    const durations = Array.from({ length: verifiedAddresses.length }, (_, row) => Array.from({ length: verifiedAddresses.length }, (_, col) => row === col ? 0 : Number.POSITIVE_INFINITY));
    const index = new Map(verifiedAddresses.map((address, position) => [address, position]));
    let complete = true;
    for (const group of groups) {
      const result = await buildMatrix(group);
      if (!result.matrix) { complete = false; continue; }
      result.matrix.addresses.forEach((from, row) => result.matrix!.addresses.forEach((to, col) => {
        durations[index.get(from)!][index.get(to)!] = result.matrix!.durations[row][col];
      }));
      if (result.matrix.provider.endsWith("partial")) complete = false;
    }
    return { matrix: { addresses: verifiedAddresses, durations, provider: complete ? "osrm-table-isolated" : "osrm-table-isolated-partial", capturedAt: new Date(now()).toISOString() }, geocodes };
  };

  return { geocode, buildMatrix, buildIsolatedMatrix };
}

const uniqueDays = (days: number[]) => [...new Set(days)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b);

export function planCalendar2Week(jobs: Calendar2Job[], weekMonday: string, employees: Calendar2Employee[], matrix: TravelMatrix): Calendar2Plan {
  const matrixIndex = new Map(matrix.addresses.map((address, index) => [normalized(address), index]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const remaining = [...jobs].sort((a, b) => a.id - b.id);
  const days: Calendar2Day[] = [];
  const unplanned: Calendar2Unplanned[] = [];

  const reject = (predicate: (job: Calendar2Job) => boolean, reason: Calendar2UnplannedReason) => {
    for (let index = remaining.length - 1; index >= 0; index--) if (predicate(remaining[index])) unplanned.push({ job: remaining.splice(index, 1)[0], reason });
  };
  reject((job) => job.fixedEmployeeId == null || !employeeById.has(job.fixedEmployeeId), "unassigned");
  reject((job) => !Number.isFinite(job.durationMin) || job.durationMin <= 0, "invalid_duration");
  reject((job) => {
    const employee = employeeById.get(job.fixedEmployeeId!);
    return Boolean(employee) && job.durationMin > employee!.workEndMin + employee!.flexMin - employee!.workStartMin && !job.previewSegment;
  }, "exceeds_daily_capacity");
  reject((job) => !matrixIndex.has(normalized(job.address)), "unverified_address");
  reject((job) => {
    const employee = employeeById.get(job.fixedEmployeeId!)!;
    return !employee.homeAddress || !matrixIndex.has(normalized(employee.homeAddress));
  }, "unverified_address");
  const invalidSourceWeekday = new Set(remaining.filter((job) => Boolean(job.fixedWeekdays?.length) && !job.fixedWeekdays!.some((day) => employeeById.get(job.fixedEmployeeId!)!.workdays.includes(day))).map((job) => job.id));

  for (const employee of [...employees].sort((a, b) => a.id - b.id)) {
    if (!employee.homeAddress) continue;
    const home = matrixIndex.get(normalized(employee.homeAddress));
    if (home == null) continue;
    for (const weekday of uniqueDays(employee.workdays)) {
      const hardEnd = employee.workEndMin;
      let cursor = employee.workStartMin;
      let current = home;
      const stops: Calendar2Stop[] = [];
      const travelLegs: TravelLeg[] = [];
      while (true) {
        let best: { remainingIndex: number; matrixIndex: number; drive: number; returnHome: number } | null = null;
        for (let index = 0; index < remaining.length; index++) {
          const candidate = remaining[index];
          if (candidate.fixedEmployeeId !== employee.id) continue;
          if (candidate.fixedWeekdays?.length && !invalidSourceWeekday.has(candidate.id) && !candidate.fixedWeekdays.includes(weekday)) continue;
          const destination = matrixIndex.get(normalized(candidate.address));
          if (destination == null) continue;
          const drive = matrix.durations[current]?.[destination];
          const returnHome = matrix.durations[destination]?.[home];
          if (!Number.isFinite(drive) || !Number.isFinite(returnHome)) continue;
          if (cursor + drive + candidate.durationMin + returnHome > hardEnd) continue;
          if (!best || drive < best.drive || (drive === best.drive && candidate.id < remaining[best.remainingIndex].id)) best = { remainingIndex: index, matrixIndex: destination, drive, returnHome };
        }
        if (!best) break;
        const candidate = remaining.splice(best.remainingIndex, 1)[0];
        const startMin = cursor + best.drive;
        const segment = candidate.previewSegment;
        stops.push({ job: candidate, startMin, endMin: startMin + candidate.durationMin, driveMin: best.drive, audit: { fixedWeekdays: candidate.fixedWeekdays ?? null, matrixFromIndex: current, matrixToIndex: best.matrixIndex, sourceWeekdayOverridden: invalidSourceWeekday.has(candidate.id), overrideReason: invalidSourceWeekday.has(candidate.id) ? "invalid_source_weekday_reassigned" : null, ...(segment ? { sourceJobId: segment.sourceJobId, sourceTaskId: segment.sourceTaskId, segmentIndex: segment.index, segmentCount: segment.count, segmentMinutes: segment.minutes, originalSourceWeek: segment.originalSourceWeek, previewWeek: weekMonday, cascadeReason: segment.reason } : {}) } });
        travelLegs.push({ from: matrix.addresses[current], to: matrix.addresses[best.matrixIndex], minutes: best.drive, kind: current === home && stops.length === 1 ? "home_to_stop" : "interstop" });
        cursor = startMin + candidate.durationMin;
        current = best.matrixIndex;
      }
      if (stops.length) {
        const returnHomeMin = matrix.durations[current][home];
        travelLegs.push({ from: matrix.addresses[current], to: matrix.addresses[home], minutes: returnHomeMin, kind: "return_home" });
        days.push({ employeeId: employee.id, weekday, stops, travelLegs, driveMin: travelLegs.reduce((sum, leg) => sum + leg.minutes, 0), serviceMin: stops.reduce((sum, stop) => sum + stop.job.durationMin, 0), returnHomeMin });
      }
    }
  }
  for (let remainingIndex = remaining.length - 1; remainingIndex >= 0; remainingIndex--) {
    const job = remaining[remainingIndex];
    if (!job.fixedWeekdays?.length || job.previewSegment) continue;
    const employee = employeeById.get(job.fixedEmployeeId!);
    const home = employee?.homeAddress ? matrixIndex.get(normalized(employee.homeAddress)) : undefined;
    const destination = matrixIndex.get(normalized(job.address));
    if (!employee || home == null || destination == null) continue;
    let best: { weekday: number; position: number; marginal: number } | null = null;
    for (const weekday of uniqueDays(employee.workdays)) {
      const day = days.find((item) => item.employeeId === employee.id && item.weekday === weekday);
      const points = [home, ...(day?.stops.map((stop) => matrixIndex.get(normalized(stop.job.address))!) ?? []), home];
      const oldTravel = points.slice(0, -1).reduce((sum, point, index) => sum + matrix.durations[point][points[index + 1]], 0);
      for (let position = 0; position < points.length - 1; position++) {
        const marginal = matrix.durations[points[position]][destination] + matrix.durations[destination][points[position + 1]] - matrix.durations[points[position]][points[position + 1]];
        const service = (day?.serviceMin ?? 0) + job.durationMin;
        if (!Number.isFinite(marginal) || service + oldTravel + marginal > employee.workEndMin - employee.workStartMin) continue;
        if (!best || marginal < best.marginal || (marginal === best.marginal && weekday < best.weekday)) best = { weekday, position, marginal };
      }
    }
    if (!best) continue;
    let day = days.find((item) => item.employeeId === employee.id && item.weekday === best!.weekday);
    if (!day) {
      day = { employeeId: employee.id, weekday: best.weekday, stops: [], travelLegs: [], driveMin: 0, serviceMin: 0, returnHomeMin: 0 };
      days.push(day);
    }
    day.stops.splice(best.position, 0, { job, startMin: 0, endMin: 0, driveMin: 0, audit: { fixedWeekdays: job.fixedWeekdays, matrixFromIndex: home, matrixToIndex: destination, sourceWeekdayOverridden: true, overrideReason: "capacity_overflow_rebalanced" } });
    let cursor = employee.workStartMin; let current = home; day.travelLegs = [];
    for (const stop of day.stops) {
      const next = matrixIndex.get(normalized(stop.job.address))!; const drive = matrix.durations[current][next];
      stop.startMin = cursor + drive; stop.endMin = stop.startMin + stop.job.durationMin; stop.driveMin = drive; stop.audit.matrixFromIndex = current; stop.audit.matrixToIndex = next;
      day.travelLegs.push({ from: matrix.addresses[current], to: matrix.addresses[next], minutes: drive, kind: current === home ? "home_to_stop" : "interstop" });
      cursor = stop.endMin; current = next;
    }
    day.returnHomeMin = matrix.durations[current][home]; day.travelLegs.push({ from: matrix.addresses[current], to: matrix.addresses[home], minutes: day.returnHomeMin, kind: "return_home" });
    day.driveMin = day.travelLegs.reduce((sum, leg) => sum + leg.minutes, 0); day.serviceMin = day.stops.reduce((sum, stop) => sum + stop.job.durationMin, 0);
    remaining.splice(remainingIndex, 1);
  }
  days.sort((a, b) => a.employeeId - b.employeeId || a.weekday - b.weekday);
  for (const job of remaining) {
    const employee = employeeById.get(job.fixedEmployeeId!);
    const home = employee?.homeAddress ? matrixIndex.get(normalized(employee.homeAddress)) : undefined;
    const destination = matrixIndex.get(normalized(job.address));
    const routeVerified = home != null && destination != null && Number.isFinite(matrix.durations[home]?.[destination]) && Number.isFinite(matrix.durations[destination]?.[home]);
    unplanned.push({ job, reason: matrix.provider === "unverified" || !routeVerified ? "unverified_route" : "overflow" });
  }
  unplanned.sort((a, b) => a.job.id - b.job.id);
  return { weekMonday, days, unplanned, audit: { optimizationContract: "deterministic-nearest-feasible-not-global-optimum", matrixProvider: matrix.provider, matrixCapturedAt: matrix.capturedAt, matrixAddresses: matrix.addresses, matrixDurations: matrix.durations } };
}

const weekTime = (week: string) => new Date(`${week}T00:00:00Z`).getTime();
const weekAt = (start: string, offset: number) => new Date(weekTime(start) + offset * 7 * 864e5).toISOString().slice(0, 10);

const effectiveTasks = (job: Calendar2Job) => (job.sourceTasks?.length
  ? job.sourceTasks.map((task) => ({ id: task.id, minutes: task.durationMin && task.durationMin > 0 ? task.durationMin : 60 }))
  : [{ id: `job:${job.id}`, minutes: job.durationMin > 0 ? job.durationMin : 60 }]);

export const calendar2RejectedTasks = (job: Calendar2Job) => (job.sourceTasks ?? [])
  .map((task) => ({ sourceTaskId: task.id, effectiveMinutes: task.durationMin && task.durationMin > 0 ? task.durationMin : 60 }));

function previewSegments(job: Calendar2Job, sourceWeek: string, employee: Calendar2Employee, matrix: TravelMatrix): Calendar2Job[] {
  const index = new Map(matrix.addresses.map((address, position) => [normalized(address), position]));
  const home = employee.homeAddress ? index.get(normalized(employee.homeAddress)) : undefined;
  const destination = index.get(normalized(job.address));
  const roundTrip = home == null || destination == null ? 0 : matrix.durations[home][destination] + matrix.durations[destination][home];
  const hardEnd = employee.workEndMin;
  const serviceCapacity = Math.max(1, hardEnd - employee.workStartMin - roundTrip);
  const chunks = effectiveTasks(job).flatMap((task) => {
    const result: { taskId: string; minutes: number }[] = [];
    for (let remaining = task.minutes; remaining > 0;) {
      const minutes = Math.min(serviceCapacity, remaining);
      result.push({ taskId: task.id, minutes }); remaining -= minutes;
    }
    return result;
  });
  return chunks.map((chunk, position) => ({ ...job, durationMin: chunk.minutes, fixedWeekdays: position === 0 ? job.fixedWeekdays : undefined,
    previewSegment: { sourceJobId: job.id, sourceTaskId: chunk.taskId, index: position + 1, count: chunks.length, minutes: chunk.minutes,
      originalSourceWeek: sourceWeek, reason: position === 0 ? "cascade_shift" : "multi_day_continuation" } }));
}

const dayTime = (date: string) => new Date(`${date}T00:00:00Z`).getTime();
const dateAt = (date: string, days: number) => new Date(dayTime(date) + days * 864e5).toISOString().slice(0, 10);
const mondayForDate = (date: string) => {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return dateAt(date, -weekday);
};
const weekdayForDate = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const sourceDate = (week: string, job: Calendar2Job, employee: Calendar2Employee) => {
  const requested = uniqueDays(job.fixedWeekdays ?? []).find((day) => employee.workdays.includes(day));
  return dateAt(week, requested ?? uniqueDays(employee.workdays)[0] ?? 0);
};

/** Calendar2 capacity contract: 08:00 to hard end 18:00 in production,
 * including home-first, interstop and return-home travel. flexMin is retained
 * in the input shape for compatibility, but never extends Calendar2 hard end.
 * Capacity is searched beyond the display horizon and can never become an
 * unplanned reason. */
export function planCalendar2Horizon(
  inputSeries: readonly Calendar2Series[], horizonStartWeek: string, horizonWeeks: number,
  employees: Calendar2Employee[], matrix: TravelMatrix, options: Calendar2HorizonOptions = {},
): Calendar2HorizonResult {
  const count = Math.max(0, horizonWeeks);
  const horizon = Array.from({ length: count }, (_, index) => weekAt(horizonStartWeek, index));
  const horizonSet = new Set(horizon);
  const reserved = new Map<string, Calendar2Job[]>(horizon.map((week) => [week, []]));
  const plans = new Map<string, Calendar2Plan>();
  const placements: Calendar2HorizonResult["placements"] = [];
  const outOfHorizon: Calendar2HorizonResult["outOfHorizon"] = [];
  const seriesAudit: Calendar2HorizonResult["seriesAudit"] = [];
  const unplanned: Calendar2HorizonResult["unplanned"] = [];

  const MAX_SEARCH_WORKDAYS = 5_200;
  const orderedSeries = inputSeries.map((series, inputIndex) => ({ series, inputIndex }))
    .sort((a, b) => (a.series.occurrences[0]?.sourceWeek ?? a.series.sourceStartWeek).localeCompare(b.series.occurrences[0]?.sourceWeek ?? b.series.sourceStartWeek) || a.inputIndex - b.inputIndex);

  for (const { series } of orderedSeries) {
    const occurrences = [...series.occurrences].sort((a, b) => a.sourceWeek.localeCompare(b.sourceWeek) || a.job.id - b.job.id);
    const first = occurrences[0];
    if (!first) {
      seriesAudit.push({ seriesId: series.seriesId, sourceStartWeek: series.sourceStartWeek, previewStartWeek: null, reason: "invalid_duration" });
      continue;
    }
    const firstEmployee = employees.find((employee) => employee.id === first.job.fixedEmployeeId);
    if (!first.job.sourceTasks?.length && (!Number.isFinite(first.job.durationMin) || first.job.durationMin <= 0)) {
      seriesAudit.push({ seriesId: series.seriesId, sourceStartWeek: series.sourceStartWeek, previewStartWeek: null, reason: "invalid_duration" });
      for (const occurrence of occurrences) unplanned.push({ seriesId: series.seriesId, sourceWeek: occurrence.sourceWeek, job: occurrence.job, reason: "invalid_duration", rejectedTasks: calendar2RejectedTasks(occurrence.job) });
      continue;
    }
    const validationJob = firstEmployee ? previewSegments(first.job, first.sourceWeek, firstEmployee, matrix)[0] : first.job;
    const validation = planCalendar2Week(validationJob ? [validationJob] : [first.job], first.sourceWeek, employees, matrix);
    const rawReason = validation.unplanned[0]?.reason;
    const dataError = rawReason && !["overflow", "exceeds_daily_capacity", "fixed_weekday_unavailable"].includes(rawReason) ? rawReason : null;
    if (!firstEmployee || dataError) {
      const reason: Calendar2UnplannedReason = firstEmployee ? dataError! : "unassigned";
      seriesAudit.push({ seriesId: series.seriesId, sourceStartWeek: series.sourceStartWeek, previewStartWeek: null, reason });
      for (const occurrence of occurrences) unplanned.push({ seriesId: series.seriesId, sourceWeek: occurrence.sourceWeek, job: occurrence.job, reason, rejectedTasks: calendar2RejectedTasks(occurrence.job) });
      continue;
    }
    let phaseDays = 0;
    let previewStartWeek: string | null = null;
    for (const occurrence of occurrences) {
      const segments = previewSegments(occurrence.job, occurrence.sourceWeek, firstEmployee, matrix);
      let searchDate = dateAt(sourceDate(occurrence.sourceWeek, occurrence.job, firstEmployee), phaseDays);
      let occurrenceFirstDate: string | null = null;
      const outsideSegments: { sourceTaskId: string; minutes: number; weekday: number }[] = [];
      for (const originalSegment of segments) {
        let placed = false;
        for (let workday = 0; workday < MAX_SEARCH_WORKDAYS; searchDate = dateAt(searchDate, 1)) {
          const weekday = weekdayForDate(searchDate);
          if (weekday >= 5 || !firstEmployee.workdays.includes(weekday)) continue;
          workday++;
          const week = mondayForDate(searchDate);
          if (options.blockedWeeks?.has(week)) continue;
          const segment = { ...originalSegment, fixedWeekdays: [weekday] };
          const combined = [...(reserved.get(week) ?? []), segment];
          const plan = planCalendar2Week(combined, week, employees, matrix);
          const hit = plan.days.find((day) => day.employeeId === firstEmployee.id && day.weekday === weekday)?.stops.find((stop) => stop.job.previewSegment?.sourceJobId === occurrence.job.id && stop.job.previewSegment?.index === segment.previewSegment?.index);
          if (!hit || plan.unplanned.length) continue;
          reserved.set(week, combined);
          plans.set(week, plan);
          occurrenceFirstDate ??= searchDate;
          if (horizonSet.has(week)) {
            // A placement denotes the source occurrence. Segment detail remains in the week plan.
          } else outsideSegments.push({ sourceTaskId: segment.previewSegment!.sourceTaskId, minutes: segment.durationMin, weekday });
          placed = true;
          break;
        }
        if (!placed) throw new Error("calendar2_system_error_search_ceiling");
      }
      if (!occurrenceFirstDate) throw new Error("calendar2_system_error_empty_occurrence");
      const previewWeek = mondayForDate(occurrenceFirstDate);
      const record = { seriesId: series.seriesId, sourceWeek: occurrence.sourceWeek, previewWeek, jobId: occurrence.job.id };
      if (horizonSet.has(previewWeek)) placements.push(record);
      if (!horizonSet.has(previewWeek) || outsideSegments.length) outOfHorizon.push({ ...record, segments: outsideSegments });
      if (occurrence === first) {
        phaseDays = Math.max(0, Math.round((dayTime(occurrenceFirstDate) - dayTime(sourceDate(occurrence.sourceWeek, occurrence.job, firstEmployee))) / 864e5));
        previewStartWeek = previewWeek;
      }
    }
    const outside = previewStartWeek != null && !horizonSet.has(previewStartWeek);
    seriesAudit.push({ seriesId: series.seriesId, sourceStartWeek: series.sourceStartWeek, previewStartWeek, reason: outside ? "capacity_deferred_outside_display_horizon" : phaseDays > 0 ? "capacity_shifted_to_earliest_day" : null });
  }

  for (const week of horizon) if (!plans.has(week)) plans.set(week, planCalendar2Week(reserved.get(week) ?? [], week, employees, matrix));
  return {
    weeks: horizon.map((weekMonday) => ({ weekMonday, plan: plans.get(weekMonday)! })),
    placements: placements.sort((a, b) => a.previewWeek.localeCompare(b.previewWeek) || a.seriesId - b.seriesId || a.jobId - b.jobId),
    outOfHorizon: outOfHorizon.sort((a, b) => a.previewWeek.localeCompare(b.previewWeek) || a.seriesId - b.seriesId),
    seriesAudit,
    unplanned: unplanned.sort((a, b) => a.sourceWeek.localeCompare(b.sourceWeek) || a.seriesId - b.seriesId || a.job.id - b.job.id),
  };
}
