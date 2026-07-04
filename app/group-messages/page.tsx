import { GROUP_MESSAGES as G } from "@/lib/funktioner";
import { getEmployeeNames } from "@/lib/queries";
import { weekOptions } from "@/lib/weeks";
import GroupMessageForm from "@/components/GroupMessageForm";

export const metadata = { title: "Gruppebeskeder · Karltoffel" };

export default async function GroupMessagesPage() {
  const employees = (await getEmployeeNames()).filter((n) => n !== "Ingen");
  const weekOpts = weekOptions(new Date(), 13, -4); // 4 weeks back → ~2 months ahead

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{G.title}</h1>
      <p className="page-desc">{G.purpose}</p>

      <div className="card">
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>{G.historyCols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody><tr><td colSpan={G.historyCols.length}><div className="table-empty">{G.historyEmpty}</div></td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <GroupMessageForm weekOpts={weekOpts} employees={employees} />
    </div>
  );
}
