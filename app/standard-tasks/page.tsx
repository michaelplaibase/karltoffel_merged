import { getStandardTasks } from "@/lib/queries";
import StandardTaskManager from "@/components/StandardTaskManager";

export const metadata = { title: "Standardopgaver · Karltoffel" };

export default async function StandardTasksPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const includeInactive = sp.inactive === "1";
  const tasks = await getStandardTasks(q, includeInactive);
  return <StandardTaskManager tasks={tasks} q={q} includeInactive={includeInactive} />;
}
