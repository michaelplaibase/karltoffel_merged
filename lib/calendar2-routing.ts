export type Coordinate = readonly [number, number];
export type GeocodeStatus = "verified" | "unverified_address";
export type GeocodeResult = { status: GeocodeStatus; normalizedAddress: string; coordinate: Coordinate | null; provider: "nominatim" };
export type TravelMatrix = { addresses: string[]; durations: number[][]; provider: string; capturedAt: string };
export type Calendar2UnplannedReason = "unassigned" | "unverified_address" | "unverified_route" | "fixed_weekday_unavailable" | "overflow";

export type Calendar2Job = {
  id: number; contactId: number; customer: string; address: string; postal: string; category: string;
  durationMin: number; source: string; fixedWeekdays?: number[]; fixedEmployeeId?: number;
};
export type Calendar2Employee = {
  id: number; name: string; homeAddress: string | null; workStartMin: number; workEndMin: number;
  flexMin: number; workdays: number[];
};
export type TravelLeg = { from: string; to: string; minutes: number; kind: "home_to_stop" | "interstop" | "return_home" };
export type Calendar2Stop = { job: Calendar2Job; startMin: number; endMin: number; driveMin: number; audit: { fixedWeekdays: number[] | null; matrixFromIndex: number; matrixToIndex: number } };
export type Calendar2Day = { employeeId: number; weekday: number; stops: Calendar2Stop[]; travelLegs: TravelLeg[]; driveMin: number; serviceMin: number; returnHomeMin: number };
export type Calendar2Unplanned = { job: Calendar2Job; reason: Calendar2UnplannedReason };
export type Calendar2Plan = {
  weekMonday: string; days: Calendar2Day[]; unplanned: Calendar2Unplanned[];
  audit: { optimizationContract: "deterministic-nearest-feasible-not-global-optimum"; matrixProvider: string; matrixCapturedAt: string; matrixAddresses: string[]; matrixDurations: number[][] };
};

type RoutingOptions = { fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; timeoutMs?: number };
const USER_AGENT = "Karltoffel-Calendar2-RoutePlanner/1.0 (+https://crm.karltoffel.dk; operations@karltoffel.dk)";
const normalized = (address: string) => address.trim().replace(/\s+/g, " ");

export function createCalendar2Routing(options: RoutingOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const geocodeCache = new Map<string, Promise<GeocodeResult>>();
  const matrixCache = new Map<string, Promise<{ matrix: TravelMatrix | null; geocodes: GeocodeResult[] }>>();
  let lastGeocodeAt = -Infinity;

  const geocode = (rawAddress: string): Promise<GeocodeResult> => {
    const address = normalized(rawAddress);
    const key = address.toLocaleLowerCase("da-DK");
    const cached = geocodeCache.get(key);
    if (cached) return cached;
    const pending = (async (): Promise<GeocodeResult> => {
      if (!address) return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "nominatim" };
      const wait = Math.max(0, 1_000 - (now() - lastGeocodeAt));
      if (wait) await sleep(wait);
      lastGeocodeAt = now();
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", `${address}, Danmark`);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", "dk");
        url.searchParams.set("addressdetails", "0");
        const response = await fetcher(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "force-cache", next: { revalidate: 30 * 86400 } });
        if (!response.ok) throw new Error(`geocode_http_${response.status}`);
        const body = await response.json() as Array<{ lat?: string; lon?: string }>;
        const lat = Number(body[0]?.lat); const lon = Number(body[0]?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 54.4 || lat > 57.9 || lon < 7.5 || lon > 15.3) {
          return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "nominatim" };
        }
        return { status: "verified", normalizedAddress: address, coordinate: [lat, lon], provider: "nominatim" };
      } catch {
        return { status: "unverified_address", normalizedAddress: address, coordinate: null, provider: "nominatim" };
      }
    })();
    geocodeCache.set(key, pending);
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
      if (geocodes.some((result) => result.status !== "verified" || !result.coordinate)) return { matrix: null, geocodes };
      try {
        const coords = geocodes.map((result) => `${result.coordinate![1]},${result.coordinate![0]}`).join(";");
        const url = new URL(`https://router.project-osrm.org/table/v1/driving/${coords}`);
        url.searchParams.set("annotations", "duration");
        const response = await fetcher(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "force-cache", next: { revalidate: 30 * 86400 } });
        if (!response.ok) throw new Error(`matrix_http_${response.status}`);
        const body = await response.json() as { code?: string; durations?: Array<Array<number | null>> };
        if (body.code !== "Ok" || !body.durations || body.durations.length !== addresses.length || body.durations.some((row) => row.length !== addresses.length || row.some((v) => v == null || !Number.isFinite(v)))) throw new Error("invalid_matrix");
        const durations = body.durations.map((row) => row.map((seconds) => Math.ceil(Number(seconds) / 60)));
        return { matrix: { addresses, durations, provider: "osrm-table", capturedAt: new Date(now()).toISOString() }, geocodes };
      } catch {
        return { matrix: null, geocodes };
      }
    })();
    matrixCache.set(key, pending);
    return pending;
  };

  return { geocode, buildMatrix };
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
  reject((job) => !matrixIndex.has(normalized(job.address)), "unverified_address");
  reject((job) => {
    const employee = employeeById.get(job.fixedEmployeeId!)!;
    return !employee.homeAddress || !matrixIndex.has(normalized(employee.homeAddress));
  }, "unverified_address");
  reject((job) => Boolean(job.fixedWeekdays?.length) && !job.fixedWeekdays!.some((day) => employeeById.get(job.fixedEmployeeId!)!.workdays.includes(day)), "fixed_weekday_unavailable");

  for (const employee of [...employees].sort((a, b) => a.id - b.id)) {
    if (!employee.homeAddress) continue;
    const home = matrixIndex.get(normalized(employee.homeAddress));
    if (home == null) continue;
    for (const weekday of uniqueDays(employee.workdays)) {
      const hardEnd = employee.workEndMin + employee.flexMin;
      let cursor = employee.workStartMin;
      let current = home;
      const stops: Calendar2Stop[] = [];
      const travelLegs: TravelLeg[] = [];
      while (true) {
        let best: { remainingIndex: number; matrixIndex: number; drive: number; returnHome: number } | null = null;
        for (let index = 0; index < remaining.length; index++) {
          const candidate = remaining[index];
          if (candidate.fixedEmployeeId !== employee.id) continue;
          if (candidate.fixedWeekdays?.length && !candidate.fixedWeekdays.includes(weekday)) continue;
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
        stops.push({ job: candidate, startMin, endMin: startMin + candidate.durationMin, driveMin: best.drive, audit: { fixedWeekdays: candidate.fixedWeekdays ?? null, matrixFromIndex: current, matrixToIndex: best.matrixIndex } });
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
  for (const job of remaining) unplanned.push({ job, reason: matrix.provider === "unverified" ? "unverified_route" : "overflow" });
  unplanned.sort((a, b) => a.job.id - b.job.id);
  return { weekMonday, days, unplanned, audit: { optimizationContract: "deterministic-nearest-feasible-not-global-optimum", matrixProvider: matrix.provider, matrixCapturedAt: matrix.capturedAt, matrixAddresses: matrix.addresses, matrixDurations: matrix.durations } };
}
