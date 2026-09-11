import { describe, expect, it } from "vitest";
import { detectFormat, extractSqliteCreateTables, ingestProgramme, looksLikeSqlite } from "./ingest";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sqliteContainer(tables: string[]): Uint8Array {
  const header = "SQLite format 3\u0000";
  const creates = tables.map((name) => `CREATE TABLE ${name}(id INTEGER)`).join("\n");
  return bytes(header + "\n" + creates + "\n");
}

const CSV = [
  "id,name,start,finish,duration,predecessors,total_float,wbs,calendar",
  "A,Enabling,2020-01-06,2020-01-10,5,,0,1.1,cal-5d",
  "B,Frame,2020-01-13,2020-01-24,10,A (FS),0,1.2,cal-5d",
  "C,Envelope,2020-01-27,2020-02-07,10,B (FS),5,1.3,cal-5d",
].join("\n");

const MSP_XML = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Task><UID>1</UID><Name>Start</Name><Start>2020-01-06T08:00:00</Start><Finish>2020-01-06T08:00:00</Finish><Duration>PT0H</Duration><Milestone>1</Milestone></Task>
  <Task><UID>2</UID><Name>Works</Name><Start>2020-01-06T08:00:00</Start><Finish>2020-01-17T17:00:00</Finish><Duration>PT80H</Duration>
    <PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink>
  </Task>
  <Calendar><UID>1</UID><Name>Standard</Name></Calendar>
</Project>`;

const XER = [
  "ERMHDR\t20.12",
  "%T\tTASK",
  "%F\ttask_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\ttask_type\ttotal_float_hr_cnt",
  "%R\t1\tA\tPrelims\t2020-01-06\t2020-01-10\t2020-01-06\t2020-01-12\tTT_Task\t0",
  "%R\t2\tB\tSuperstructure\t2020-01-13\t2020-01-24\t\t\tTT_Task\t16",
  "%T\tTASKPRED",
  "%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt",
  "%R\t2\t1\tPR_FS\t0",
  "%T\tCALENDAR",
  "%F\tclndr_id\tclndr_name",
  "%R\t1\tStandard",
].join("\n");

describe("detectFormat", () => {
  it("recognises Asta SQLite .pp, XER, MSP XML, CSV, JSON and PDF", () => {
    expect(detectFormat("Rev10d.pp", sqliteContainer(["BAR", "LINK"]))).toBe("asta_pp");
    expect(detectFormat("export.xer", bytes(XER))).toBe("p6_xer");
    expect(detectFormat("plan.xml", bytes(MSP_XML))).toBe("msp_xml");
    expect(detectFormat("bars.csv", bytes(CSV))).toBe("csv");
    expect(detectFormat("snap.json", bytes('{"activities":[]}'))).toBe("json");
    expect(detectFormat("gantt.pdf", bytes("%PDF-1.4"))).toBe("pdf");
  });

  it("treats a .pp that is actually XML as Asta XML", () => {
    expect(detectFormat("export.pp", bytes("<Project><Task></Task></Project>"))).toBe("asta_xml");
  });
});

describe("Asta .pp inspect", () => {
  it("detects the SQLite magic and lists BAR/LINK/CALENDAR without inventing activities", () => {
    const parsed = ingestProgramme("Welbourne Rev 10d.pp", sqliteContainer(["BAR", "LINK", "CALENDAR", "WBS"]));
    expect(looksLikeSqlite(sqliteContainer(["BAR"]))).toBe(true);
    expect(extractSqliteCreateTables(sqliteContainer(["BAR", "LINK"])).map((t) => t.name)).toEqual(["BAR", "LINK"]);
    expect(parsed.format).toBe("asta_pp");
    expect(parsed.status).toBe("partial");
    expect(parsed.engine).toBe("asta_pp_sqlite_inspect_v1");
    expect(parsed.schedule.activities).toEqual([]);
    expect(parsed.issues.some((item) => item.code === "asta_pp_export_required")).toBe(true);
    expect(parsed.issues.some((item) => item.detail.includes("BAR"))).toBe(true);
  });

  it("fails a .pp that is not SQLite and is not XML", () => {
    const parsed = ingestProgramme("broken.pp", bytes("not a programme"));
    expect(parsed.status).toBe("failed");
    expect(parsed.issues[0]?.code).toBe("asta_pp_not_sqlite");
  });

  it("flags a truncated SQLite container with no activity table", () => {
    const parsed = ingestProgramme("tiny.pp", sqliteContainer(["NOTES"]));
    expect(parsed.issues.some((item) => item.code === "missing_activities")).toBe(true);
    expect(parsed.issues.some((item) => item.code === "truncated_file")).toBe(true);
  });
});

describe("structured ingest", () => {
  it("maps CSV WBS, calendars, FS links and strips a leading semicolon", () => {
    const csv = CSV.replace("Frame", ";Frame");
    const parsed = ingestProgramme("rev.csv", bytes(csv));
    expect(parsed.status).toBe("parsed");
    expect(parsed.schedule.activities).toHaveLength(3);
    expect(parsed.schedule.activities[1]?.name).toBe("Frame");
    expect(parsed.issues.some((item) => item.code === "semicolon_prefix_names")).toBe(true);
    expect(parsed.schedule.links).toEqual([
      { predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 },
      { predecessorId: "B", successorId: "C", type: "FS", lagDays: 0 },
    ]);
    expect(parsed.schedule.activities[0]?.wbs).toBe("1.1");
    expect(parsed.schedule.activities[0]?.calendarId).toBe("cal-5d");
  });

  it("maps MSP XML tasks, FS predecessors and calendars", () => {
    const parsed = ingestProgramme("plan.xml", bytes(MSP_XML));
    expect(parsed.format).toBe("msp_xml");
    expect(parsed.schedule.activities.map((a) => a.id)).toEqual(["1", "2"]);
    expect(parsed.schedule.activities[0]?.milestone).toBe(true);
    expect(parsed.schedule.links).toEqual([{ predecessorId: "1", successorId: "2", type: "FS", lagDays: 0 }]);
    expect(parsed.schedule.calendars[0]?.name).toBe("Standard");
  });

  it("maps a P6 XER TASK / TASKPRED / CALENDAR set", () => {
    const parsed = ingestProgramme("baseline.xer", bytes(XER));
    expect(parsed.format).toBe("p6_xer");
    expect(parsed.status).toBe("parsed");
    expect(parsed.schedule.activities).toHaveLength(2);
    expect(parsed.schedule.activities[0]?.actualFinish).toBe("2020-01-12");
    expect(parsed.schedule.links).toEqual([{ predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 }]);
    expect(parsed.schedule.calendars[0]?.name).toBe("Standard");
    expect(parsed.schedule.programmeType).toBe("interim");
  });

  it("accepts a JSON snapshot with impact events", () => {
    const parsed = ingestProgramme(
      "snap.json",
      bytes(
        JSON.stringify({
          name: "Rev 10d",
          programmeType: "as_built",
          dataDate: "2020-02-01",
          impactEvents: ["CE-047"],
          activities: [
            { id: "A", name: "Prelims", start: "2020-01-06", finish: "2020-01-10", durationDays: 5 },
            { id: "B", name: "Frame", start: "2020-01-13", finish: "2020-01-24", durationDays: 10 },
          ],
          links: [{ predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 }],
        })
      )
    );
    expect(parsed.schedule.name).toBe("Rev 10d");
    expect(parsed.schedule.programmeType).toBe("as_built");
    expect(parsed.schedule.impactEvents).toEqual(["CE-047"]);
    expect(parsed.schedule.links).toHaveLength(1);
  });

  it("rejects a CSV with unmapped columns and an empty file", () => {
    expect(ingestProgramme("x.csv", bytes("foo,bar\n1,2")).status).toBe("failed");
    expect(ingestProgramme("x.csv", bytes("id,name\n")).issues[0]?.code).toBe("csv_empty");
  });

  it("drops links to unknown ids and reports reverse dates", () => {
    const parsed = ingestProgramme(
      "messy.csv",
      bytes("id,name,start,finish,predecessors\nA,One,2020-02-01,2020-01-01,Z\n")
    );
    expect(parsed.issues.some((item) => item.code === "missing_link_ends")).toBe(true);
    expect(parsed.issues.some((item) => item.code === "reverse_dates")).toBe(true);
    expect(parsed.schedule.links).toEqual([]);
  });
});

describe("PDF mark-up", () => {
  it("refuses to map activities from a printed Gantt", () => {
    const parsed = ingestProgramme(
      "gantt.pdf",
      bytes("%PDF-1.4\nBT (Critical path 12 days 01/02/2020) Tj ET")
    );
    expect(parsed.format).toBe("pdf");
    expect(parsed.status).toBe("partial");
    expect(parsed.schedule.evidence).toBe("markup_only");
    expect(parsed.schedule.activities).toEqual([]);
    expect(parsed.issues.some((item) => item.code === "pdf_not_schedule_evidence")).toBe(true);
  });
});
