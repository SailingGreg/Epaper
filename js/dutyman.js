/*
 * dutyman.js - duty assignments from a DutyMan roster (dutyman.biz), in JavaScript
 *
 * A port of dutymand.py (used by races.py) with no dependencies. It reads the roster's public
 * embed page (dmembed.aspx, mode 2): one table row per duty, with date, event, duty and member,
 * where the date and event are left blank on the rows that follow for the same day.
 *
 * Load it with <script src="dutyman.js"> (it sets window.Dutyman) or require("./dutyman.js") in Node.
 * dutyman.biz allows cross-origin reads (Access-Control-Allow-Origin: *), so a web page can fetch the
 * roster directly, as long as its Content Security Policy allows https://dutyman.biz in connect-src.
 * The request sends no custom headers, so the browser makes it without a preflight (which DutyMan
 * answers with 405). On a server, Node 18+ has fetch.
 *
 *   const Dutyman = require("./dutyman.js");
 *   const duties = await Dutyman.fetchDuties("R0001532");
 *   Dutyman.dutiesOn(duties, "2026-10-25")   // [{date, event, duty, person}]
 *   Dutyman.dutyList(duties, "2026-10-25")   // "Duties: Safety Boat 1, A Sailor. Safety Boat 2, ..."
 *
 * Differences from dutymand.py:
 *   - The roster ID is a parameter (dutymand.py always read R0001532).
 *   - The roster shows dates without a year ("Sun, 25 Oct"). The year is the one, within a year either
 *     side of today, where that date falls on the weekday shown, so December's list doesn't put
 *     January's duties in the past.
 *   - A duty nobody has taken is kept, with person "" (dutymand.py dropped it); dutyList() shows it
 *     as "vacant".
 *
 * Distributed under MIT License, Copyright (c) 2020 Greg Brougham (see LICENSE)
 */
(function (root) {
  "use strict";

  const EMBED_URL = "https://dutyman.biz/dmembed.aspx";
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

  // The roster's embed page, which needs no login
  function dutymanUrl(rosterId, maxRows = 9999) {
    if (!/^[A-Za-z0-9]+$/.test(String(rosterId || ""))) throw new Error("Invalid DutyMan roster ID");
    return `${EMBED_URL}?id=${encodeURIComponent(rosterId)}&mode=2&maxrows=${Number(maxRows) || 9999}`;
  }

  function decode(text) {
    return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name) => {
      if (name[0] === "#") {
        const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    });
  }

  // The text of a cell's first <span>, as dutymand.py's td[n]/span[1]/text()
  function spanText(cell) {
    const span = /<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(cell);
    return span ? decode(span[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() : "";
  }

  function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // "Sun, 25 Oct", "Today" or "Tomorrow" as "YYYY-MM-DD", or null if it isn't a date
  function rosterDate(text, now = new Date()) {
    const value = text.trim().toLowerCase();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (value === "today") return iso(today);
    if (value === "tomorrow") return iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    const m = /^(?:([a-z]{3})[a-z]*,?\s+)?(\d{1,2})\s+([a-z]{3})[a-z]*(?:\s+(\d{4}))?$/.exec(value);
    if (!m || !MONTHS.includes(m[3])) return null;
    const day = Number(m[2]), month = MONTHS.indexOf(m[3]);
    if (m[4]) return iso(new Date(Number(m[4]), month, day));
    const weekday = m[1] ? DAYS.indexOf(m[1]) : -1;
    // This year, next year or last year: the one on the weekday shown, else the nearest to today
    const candidates = [0, 1, -1].map(k => new Date(today.getFullYear() + k, month, day))
      .filter(d => d.getMonth() === month);
    const onWeekday = candidates.filter(d => d.getDay() === weekday);
    const pool = onWeekday.length ? onWeekday : candidates;
    if (!pool.length) return null;
    pool.sort((a, b) => Math.abs(a - today) - Math.abs(b - today));
    return iso(pool[0]);
  }

  // The duties on a roster embed page: [{date: "YYYY-MM-DD", event, duty, person}], in the page's order
  function parseDuties(html, { now = new Date() } = {}) {
    const duties = [];
    let date = null, event = "", duty = "";
    for (const row of String(html).match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
      const cells = row.match(/<td\b[\s\S]*?<\/td>/gi) || [];
      if (cells.length < 4) continue;
      const [dateText, eventText, dutyText, person] = cells.slice(0, 4).map(spanText);
      // A blank date, event or duty carries on from the row above
      if (dateText) date = rosterDate(dateText, now) || date;
      if (eventText) event = eventText;
      if (dutyText) duty = dutyText;
      if (!date || !dutyText) continue;
      duties.push({ date, event, duty, person });
    }
    return duties;
  }

  async function fetchDuties(rosterId, { maxRows = 9999, now = new Date(), fetch: get = root.fetch } = {}) {
    if (typeof get !== "function") throw new Error("No fetch available (Node 18+ or pass { fetch })");
    // No custom headers: a header such as User-Agent would make browsers send a preflight, which fails
    const response = await get(dutymanUrl(rosterId, maxRows));
    if (!response.ok) throw new Error(`DutyMan returned ${response.status}`);
    return parseDuties(await response.text(), { now });
  }

  // The duties on one day ("YYYY-MM-DD")
  function dutiesOn(duties, date) {
    return duties.filter(d => d.date === date);
  }

  // One day's duties as races.py's summary line: "Duties: Safety Boat 1, A Sailor. Safety Boat 2, vacant"
  function dutyList(duties, date) {
    return "Duties: " + dutiesOn(duties, date).map(d => `${d.duty}, ${d.person || "vacant"}`).join(". ");
  }

  // The events on the roster: [{date, event}], once each
  function events(duties) {
    const seen = new Map();
    for (const d of duties) seen.set(`${d.date}|${d.event}`, { date: d.date, event: d.event });
    return [...seen.values()];
  }

  const api = { dutymanUrl, parseDuties, fetchDuties, rosterDate, dutiesOn, dutyList, events };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Dutyman = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
