import { loadData, loadPrefs, savePrefs, hasLocalData, defaultsNewer } from "./store.js";
import { UNIT_DAYS, days, options, socRange, overallRange, casualPlan, perkSavings, SOC_ID } from "./calc.js";
import { money, date, period, plural, hostname, planPrice, el } from "./format.js";

const data = loadData();
const $ = (id) => document.getElementById(id);

const prefs = {
  freq: { n: 2, unit: "month" },
  tf: { ...data.settings.timeframe },
  gym: "all",
  ...(loadPrefs() || {}),
};

// ---------- helpers ----------

const tfDays = () => days(prefs.tf) || UNIT_DAYS.year;
const visits = () => Math.round((Number(prefs.freq.n) || 0) * tfDays() / UNIT_DAYS[prefs.freq.unit]);

// "a year" for exactly one year/month/week, otherwise "over 6 months"
const tfPhrase = () => (prefs.tf.n === 1 ? `a ${prefs.tf.unit}` : `over ${period(prefs.tf)}`);

// The same visit count expressed per the unit the user typed in, when that differs.
function perUnitHint(min, max) {
  const per = tfDays() / UNIT_DAYS[prefs.freq.unit];
  if (Math.abs(per - 1) < 1e-9) return "";
  const f = (v) => {
    const x = v / per;
    return x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  };
  return max === null ? ` (about ${f(min)}+ a ${prefs.freq.unit})` : ` (about ${f(min)}–${f(max)} a ${prefs.freq.unit})`;
}

function rangeSentence(r, where) {
  if (!r || r.min === null) return [`The membership never beats the other options ${where}.`];
  const range = r.capped
    ? [el("strong", {}, `${r.min}+ visits`), ` ${tfPhrase()}`]
    : [el("strong", {}, `${r.min}–${r.max} visits`), ` ${tfPhrase()}`];
  return [`The membership is the cheapest option ${where} at `, ...range, perUnitHint(r.min, r.capped ? null : r.max), "."];
}

const checkedText = (item) => (item.edited ? "edited locally" : `checked ${date(item.checked || data.updated)}`);

function sourceCell(url, text) {
  return el("span", { class: "source" },
    url ? el("a", { href: url, target: "_blank", rel: "noopener" }, hostname(url)) : "no source",
    el("span", { class: "muted" }, ` · ${text}`));
}

// ---------- calculator ----------

function renderResult() {
  const tf = tfDays();
  const v = visits();
  const out = $("result");
  out.replaceChildren();

  if (prefs.gym === "all") {
    out.append(el("p", {}, ...rangeSentence(overallRange(data, tf), `across the ${data.gyms.length} gyms`)));
    const wins = data.gyms.filter((g) => options(data, g, v, tf)[0].id === SOC_ID);
    out.append(el("p", { class: "muted" },
      `At your ${plural(v, "visit")} ${tfPhrase()}, it's the cheapest option at ${wins.length} of ${data.gyms.length} gyms.`));
    return;
  }

  const gym = data.gyms.find((g) => g.id === prefs.gym);
  if (!gym) return;
  const r = socRange(data, gym, tf);
  const rangeLine = el("p", {}, ...rangeSentence(r, `at ${gym.name}`));
  if (r.beatenBy) rangeLine.append(` Above that, the ${r.beatenBy.label.toLowerCase()} is cheaper.`);
  out.append(rangeLine);

  if (v <= 0) return;
  const opts = options(data, gym, v, tf);
  const best = opts[0];
  const soc = opts.find((o) => o.id === SOC_ID);
  const casual = casualPlan(gym) && opts.find((o) => o.id === casualPlan(gym).id);
  const line = el("p", { class: "muted" }, `At your ${plural(v, "visit")} ${tfPhrase()}: `);
  if (best.id === SOC_ID) {
    const next = opts[1];
    line.append(`the membership is cheapest at ${money(soc.cost)} in total`);
    if (casual) line.append(`, ${money(casual.cost - soc.cost)} less than casual entry`);
    if (next && next !== casual) line.append(` and ${money(next.cost - soc.cost)} less than the ${next.label.toLowerCase()}`);
    line.append(".");
  } else {
    line.append(`the ${best.label.toLowerCase()} is cheapest at ${money(best.cost)}. With the membership you'd pay ${money(soc.cost)}`);
    if (casual && casual.cost > soc.cost) line.append(`, still ${money(casual.cost - soc.cost)} less than casual entry`);
    line.append(".");
  }
  out.append(line);
}

// ---------- gym cards ----------

function gymCard(gym) {
  const tf = tfDays();
  const v = visits();
  const r = socRange(data, gym, tf);
  const casual = casualPlan(gym);
  const saving = casual ? Number(casual.price) - gym.socPrice : null;
  const opts = options(data, gym, v, tf);
  const cheapest = v > 0 ? opts[0].id : null;
  const costOf = (id) => opts.find((o) => o.id === id).cost;

  const rangeText = r.min === null ? "Never cheapest"
    : r.capped ? `Best from ${r.min}+ visits ${tfPhrase()}` : `Best for ${r.min}–${r.max} visits ${tfPhrase()}`;

  const summary = el("summary", {},
    el("span", { class: "gym-name" }, gym.name, gym.requiresUniId ? el("span", { class: "tag", title: "Uni ID needed for the soc price" }, "uni ID") : null),
    el("span", { class: "gym-meta" },
      el("span", {}, `Soc ${money(gym.socPrice)}`),
      casual ? el("span", {}, `casual ${money(Number(casual.price))}`) : null,
      saving !== null ? el("span", {}, `${saving >= 0 ? "save" : "costs"} ${money(Math.abs(saving))}/visit`) : null,
      el("span", { class: "range" }, rangeText)));

  const socEdited = gym.socEdited || data.membership.edited;
  const rows = [
    el("tr", { class: cheapest === SOC_ID ? "best" : "" },
      el("td", { "data-label": "Option" }, el("strong", {}, "BoulderSoc member"), gym.socNote ? el("div", { class: "note" }, gym.socNote) : null),
      el("td", { "data-label": "Price" }, `${money(gym.socPrice)} / visit + ${money(data.membership.fee)} ${data.membership.length.n === 1 ? `a ${data.membership.length.unit}` : `per ${period(data.membership.length)}`}`),
      el("td", { "data-label": `Cost (${v})`, class: "num" }, money(costOf(SOC_ID))),
      el("td", { "data-label": "Source" }, sourceCell(data.soc.source, socEdited ? "edited locally" : `posted ${date(data.soc.posted)}`))),
    ...gym.plans.map((p) =>
      el("tr", { class: cheapest === p.id ? "best" : "" },
        el("td", { "data-label": "Option" },
          p.label,
          p.audience && p.audience !== "all" ? el("span", { class: "muted" }, ` (${p.audience})`) : null,
          p.verified === false ? el("span", { class: "tag warn", title: "Couldn't fully confirm this price" }, "unverified") : null,
          p.note ? el("div", { class: "note" }, p.note) : null),
        el("td", { "data-label": "Price" }, planPrice(p)),
        el("td", { "data-label": `Cost (${v})`, class: "num" }, money(costOf(p.id))),
        el("td", { "data-label": "Source" }, sourceCell(p.source || gym.source, checkedText(p))))),
  ];

  const table = el("table", { class: "plans" },
    el("thead", {}, el("tr", {},
      el("th", {}, "Option"), el("th", {}, "Price"),
      el("th", { class: "num" }, `Cost for ${plural(v, "visit")}`), el("th", {}, "Source"))),
    el("tbody", {}, rows));

  const notes = [
    gym.requiresUniId ? "Bring a valid uni ID for the soc price." : null,
    ...(gym.notes || []),
  ].filter(Boolean);

  return el("details", { class: "gym", id: `gym-${gym.id}` }, summary,
    el("div", { class: "gym-body" },
      el("div", { class: "table-wrap" }, table),
      r.beatenBy ? el("p", { class: "muted" }, `Above ${plural(r.max, "visit")} ${tfPhrase()}, the ${r.beatenBy.label.toLowerCase()} works out cheaper.`) : null,
      notes.length ? el("ul", { class: "notes" }, notes.map((n) => el("li", {}, n))) : null,
      el("p", { class: "muted small" }, "Intro offers and free first weeks aren't counted in the maths.")));
}

function renderGyms() {
  const open = new Set([...document.querySelectorAll("details.gym[open]")].map((d) => d.id));
  $("gyms-sub").textContent = `Costs for ${plural(visits(), "visit")} ${tfPhrase()}. The cheapest option is highlighted. Shoe hire isn't included.`;
  $("gyms").replaceChildren(...data.gyms.map(gymCard));
  if (prefs.gym !== "all") open.add(`gym-${prefs.gym}`);
  for (const id of open) document.getElementById(id)?.setAttribute("open", "");
}

// ---------- perks & footer ----------

function renderPerks() {
  const items = [...data.stores.map((s) => ({ ...s, type: "Store" })), ...data.food.map((f) => ({ ...f, type: "Food" }))];
  $("perks").replaceChildren(...items.map((s) => {
    const pct = Number(s.discountPct);
    const spend = Number(s.expectedSpend) || 0;
    return el("li", {},
      el("span", {}, s.name, el("span", { class: "muted" }, ` · ${s.type.toLowerCase()}`)),
      el("span", { class: "num" },
        pct ? `${pct}% off` : "discount (ask the soc)",
        spend && pct ? el("span", { class: "muted" }, ` · saves ${money(spend * pct / 100)}/yr`) : null));
  }));
  const perks = perkSavings(data, UNIT_DAYS.year);
  if (perks > 0) $("perks").append(el("li", { class: "total" }, el("span", {}, "Counted in the maths"), el("span", { class: "num" }, `${money(perks)} a year`)));
}

function renderFooter() {
  $("footer").replaceChildren(
    el("p", {}, `Gym prices checked ${date(data.updated)}; soc prices from the BoulderSoc post of ${date(data.soc.posted)}. `,
      "Unofficial: not affiliated with UNSW BoulderSoc or any gym. Check with the gym before you buy."),
    hasLocalData() ? el("p", {}, "You're using values edited on this device. ", el("a", { href: "settings.html" }, "Reset in Settings"), ".") : "",
    defaultsNewer() ? el("p", { class: "warn-text" }, "Newer default prices are available. Reset in Settings to load them.") : "");
}

// ---------- wiring ----------

function render() {
  $("fee").textContent = money(data.membership.fee);
  renderResult();
  renderGyms();
}

function initForm() {
  $("gym").replaceChildren(
    el("option", { value: "all" }, "any gym"),
    ...data.gyms.map((g) => el("option", { value: g.id }, g.name)));
  $("freq-n").value = prefs.freq.n;
  $("freq-unit").value = prefs.freq.unit;
  $("tf-n").value = prefs.tf.n;
  $("tf-unit").value = prefs.tf.unit;
  $("gym").value = data.gyms.some((g) => g.id === prefs.gym) ? prefs.gym : "all";

  $("calc-form").addEventListener("input", () => {
    prefs.freq = { n: Math.max(0, Number($("freq-n").value) || 0), unit: $("freq-unit").value };
    prefs.tf = { n: Math.max(1, Number($("tf-n").value) || 1), unit: $("tf-unit").value };
    prefs.gym = $("gym").value;
    savePrefs(prefs);
    render();
  });
}

initForm();
render();
renderPerks();
renderFooter();
