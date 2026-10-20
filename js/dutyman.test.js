// node --test js/dutyman.test.js   (Node 18+; the names below are made up)
const test = require("node:test");
const assert = require("node:assert/strict");
const Dutyman = require("./dutyman.js");

const row = (date, event, duty, person) => `<tr>
  <td class="datecolumn"><span class="datefont">${date}</span></td><td class="eventcolumn">
  <span class="eventfont">${event}</span></td><td class="dutycolumn"><span class="dutyfont">${duty}</span>
  </td><td class="namecolumn"><span class="namefont">${person}</span></td></tr>`;

const PAGE = `<html><body><table>
  <tr><th>Date</th><th>Event</th><th>Duty</th><th>Member</th></tr>
  ${row("Sat, 24 Oct", "Autumn Series", "Safety Boat 1", "Ann Example")}
  ${row("", "", "Safety Boat 2", "Bob O&#39;Sample")}
  ${row("Sun, 25 Oct", "Merlin Open (Upriver)", "Race Officer", "Cat Test")}
  ${row("", "", "Safety Boat 1", "")}
  ${row("Sun, 03 Jan", "New Year &amp; Pursuit", "Race Officer", "Dan Demo")}
</table></body></html>`;

const NOW = new Date(2026, 9, 20); // Tue 20 Oct 2026

test("parses duties, carrying the date and event down", () => {
  assert.deepEqual(Dutyman.parseDuties(PAGE, { now: NOW }), [
    { date: "2026-10-24", event: "Autumn Series", duty: "Safety Boat 1", person: "Ann Example" },
    { date: "2026-10-24", event: "Autumn Series", duty: "Safety Boat 2", person: "Bob O'Sample" },
    { date: "2026-10-25", event: "Merlin Open (Upriver)", duty: "Race Officer", person: "Cat Test" },
    { date: "2026-10-25", event: "Merlin Open (Upriver)", duty: "Safety Boat 1", person: "" },
    { date: "2027-01-03", event: "New Year & Pursuit", duty: "Race Officer", person: "Dan Demo" },
  ]);
});

test("summary line as races.py prints it", () => {
  const duties = Dutyman.parseDuties(PAGE, { now: NOW });
  assert.equal(Dutyman.dutyList(duties, "2026-10-24"), "Duties: Safety Boat 1, Ann Example. Safety Boat 2, Bob O'Sample");
  assert.equal(Dutyman.dutyList(duties, "2026-10-25"), "Duties: Race Officer, Cat Test. Safety Boat 1, vacant");
  assert.equal(Dutyman.dutyList(duties, "2026-10-26"), "Duties: ");
  assert.deepEqual(Dutyman.events(duties).map(e => e.date), ["2026-10-24", "2026-10-25", "2027-01-03"]);
});

test("dates without a year take the year whose weekday matches", () => {
  assert.equal(Dutyman.rosterDate("Sun, 03 Jan", NOW), "2027-01-03");
  assert.equal(Dutyman.rosterDate("Sat, 03 Jan", NOW), "2026-01-03");
  assert.equal(Dutyman.rosterDate("Sat, 24 Oct", NOW), "2026-10-24");
  assert.equal(Dutyman.rosterDate("24 Oct", NOW), "2026-10-24");
  assert.equal(Dutyman.rosterDate("Today", NOW), "2026-10-20");
  assert.equal(Dutyman.rosterDate("Tomorrow", new Date(2026, 11, 31)), "2027-01-01");
  assert.equal(Dutyman.rosterDate("Mon, 29 Feb", NOW), null); // no leap year within a year of 2026
  assert.equal(Dutyman.rosterDate("Thu, 29 Feb", new Date(2027, 11, 1)), "2028-02-29");
  assert.equal(Dutyman.rosterDate("nonsense", NOW), null);
});

test("roster IDs are checked before going into the URL", () => {
  assert.equal(Dutyman.dutymanUrl("R0001532", 40), "https://dutyman.biz/dmembed.aspx?id=R0001532&mode=2&maxrows=40");
  assert.throws(() => Dutyman.dutymanUrl("R1&mode=1"));
});

test("fetchDuties uses the fetch it is given", async () => {
  let asked;
  const fetch = async url => { asked = url; return { ok: true, status: 200, text: async () => PAGE }; };
  const duties = await Dutyman.fetchDuties("R0001532", { fetch, now: NOW });
  assert.equal(duties.length, 5);
  assert.match(asked, /id=R0001532&mode=2/);
  await assert.rejects(Dutyman.fetchDuties("R0001532", { fetch: async () => ({ ok: false, status: 503 }) }), /503/);
});
