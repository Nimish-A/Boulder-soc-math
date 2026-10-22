import { loadData, loadPrefs, savePrefs, hasLocalData, defaultsNewer } from "./store.js";
import { UNIT_DAYS, days, options, planCost, socRange, overallRange, casualPlan, perkSavings, SOC_ID } from "./calc.js";
import { money, date, period, plural, hostname, planPrice, el } from "./format.js";

const data = loadData();
const $ = (id) => document.getElementById(id);

const prefs = {
  freq: { n: 2, unit: "month" },
  tf: { ...data.settings.timeframe },
  gyms: null, // ids of ticked gyms; null = all
  lockIn: null, // longest commitment in months you'd sign up for; null = any
  ...(loadPrefs() || {}),
};
// Older saved prefs had a single `gym` from a dropdown.
if (prefs.gyms === null && prefs.gym && prefs.gym !== "all") prefs.gyms = [prefs.gym];
delete prefs.gym;

// ---------- helpers ----------

const selectedGyms = () => (prefs.gyms ? data.gyms.filter((g) => prefs.gyms.includes(g.id)) : data.gyms);

// Slider stops for the max lock-in, in months (null = any length).
const LOCK_STEPS = [0, 1, 3, 6, 12, null];
const lockLabel = (m) => (m === null ? "any length" : m === 0 ? "none" : plural(m, "month"));

// How long a plan ties you in: a prepaid length, or a recurring plan's minimum term.
function lockDays(plan) {
  if (plan.kind === "prepaid") return days(plan.length);
  if (plan.kind === "recurring") return Math.max(days(plan.minTerm), days(plan.billing));
  return 0;
}

const withinLockIn = (plan) => prefs.lockIn === null || lockDays(plan) <= prefs.lockIn * UNIT_DAYS.month + 1e-6;

// The gym with only the plans you'd actually sign up for.
const eligible = (gym) => ({ ...gym, plans: gym.plans.filter(withinLockIn) });

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

// "**5–83 visits** a year (about 0.1–1.6 a week)"
const rangeBits = (r) => [
  el("strong", {}, r.capped ? `${r.min}+ visits` : `${r.min}–${r.max} visits`),
  ` ${tfPhrase()}`,
  perUnitHint(r.min, r.capped ? null : r.max),
];

function rangeSentence(r, where) {
  if (!r || r.min === null) return [`The membership never beats the other options ${where}.`];
  return [`The membership is the cheapest option ${where} for `, ...rangeBits(r), "."];
}

// `all` is false when only some gyms are ticked, which changes the wording.
function overallSentence(o, all) {
  const every_ = all ? "every gym" : "every gym you ticked";
  const some_ = all ? "some gyms" : "some of them";
  if (!o) return [`The membership never beats the other options at ${all ? "any gym" : "the gyms you ticked"}.`];
  const { some, every } = o;
  const someText = some.capped ? `from ${some.min} visits up` : `from ${some.min} up to ${some.max} visits`;
  if (!every) {
    return [`The membership is the cheapest option at ${some_} for `, ...rangeBits(some),
      `, but there's no visit count where it wins at ${every_}.`];
  }
  const same = every.min === some.min && every.max === some.max && every.capped === some.capped;
  return [`The membership is the cheapest option at ${every_} for `, ...rangeBits(every), ".",
    same ? "" : ` At ${some_} it stays cheapest ${someText}.`];
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

  const gyms = selectedGyms().map(eligible);
  if (!gyms.length) {
    out.append(el("p", { class: "muted" }, "Tick at least one gym."));
    return;
  }

  if (gyms.length > 1) {
    const all = gyms.length === data.gyms.length;
    out.append(el("p", {}, ...overallSentence(overallRange(data, tf, gyms), all)));
    const wins = gyms.filter((g) => options(data, g, v, tf)[0].id === SOC_ID);
    const n = gyms.length;
    const names = wins.length && wins.length < n && wins.length <= 4 ? `: ${wins.map((g) => g.name).join(", ")}` : "";
    out.append(el("p", { class: "muted" },
      `At your ${plural(v, "visit")} ${tfPhrase()}, it's the cheapest option at ${wins.length === n ? `all ${n}` : `${wins.length} of ${n}`} ${all ? "" : "ticked "}gyms${names}.`));
    return;
  }

  const gym = gyms[0];
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

// Cost cell: total, then per visit and the difference against casual entry.
function costCell(cost, v, casualCost, isCasual) {
  const sub = [];
  if (v > 0 && Number.isFinite(cost)) sub.push(`${money(cost / v)}/visit`);
  if (!isCasual && Number.isFinite(casualCost) && v > 0) {
    const diff = casualCost - cost;
    if (Math.abs(diff) >= 0.005) sub.push(diff > 0 ? `saves ${money(diff)}` : `${money(-diff)} more than casual`);
  }
  return el("span", { class: "cost" }, money(cost), sub.length ? el("span", { class: "per" }, sub.join(" · ")) : null);
}

function gymCard(gym) {
  const tf = tfDays();
  const v = visits();
  const eg = eligible(gym);
  const r = socRange(data, eg, tf);
  const casual = casualPlan(gym);
  const saving = casual ? Number(casual.price) - gym.socPrice : null;
  const opts = options(data, eg, v, tf);
  const cheapest = v > 0 ? opts[0].id : null;
  const costOf = (id) => opts.find((o) => o.id === id)?.cost ?? planCost(gym.plans.find((p) => p.id === id), v, tf, data.settings);
  const casualCost = casual ? costOf(casual.id) : NaN;

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
      el("td", { "data-label": `Cost (${v})`, class: "num" }, costCell(costOf(SOC_ID), v, casualCost, false)),
      el("td", { "data-label": "Source" }, sourceCell(data.soc.source, socEdited ? "edited locally" : `posted ${date(data.soc.posted)}`))),
    ...gym.plans.map((p) =>
      el("tr", { class: cheapest === p.id ? "best" : withinLockIn(p) ? "" : "excluded" },
        el("td", { "data-label": "Option" },
          p.label,
          p.audience && p.audience !== "all" ? el("span", { class: "muted" }, ` (${p.audience})`) : null,
          p.verified === false ? el("span", { class: "tag warn", title: "Couldn't fully confirm this price" }, "unverified") : null,
          withinLockIn(p) ? null : el("span", { class: "tag" }, "over your lock-in"),
          p.note ? el("div", { class: "note" }, p.note) : null),
        el("td", { "data-label": "Price" }, planPrice(p)),
        el("td", { "data-label": `Cost (${v})`, class: "num" }, costCell(costOf(p.id), v, casualCost, p === casual)),
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
  const gyms = selectedGyms();
  const showing = gyms.length < data.gyms.length ? `Showing the ${plural(gyms.length, "gym")} you ticked. ` : "";
  $("gyms-sub").textContent = `${showing}Costs for ${plural(visits(), "visit")} ${tfPhrase()}. The cheapest option is highlighted. Shoe hire isn't included.`;
  $("gyms").replaceChildren(...gyms.map(gymCard));
  if (gyms.length === 1) open.add(`gym-${gyms[0].id}`);
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
  $("lock-label").textContent = lockLabel(prefs.lockIn);
  renderResult();
  renderGyms();
}

const gymBoxes = () => [...document.querySelectorAll("#gym-pick input[type=checkbox]")];

function update() {
  prefs.freq = { n: Math.max(0, Number($("freq-n").value) || 0), unit: $("freq-unit").value };
  prefs.tf = { n: Math.max(1, Number($("tf-n").value) || 1), unit: $("tf-unit").value };
  const ticked = gymBoxes().filter((b) => b.checked).map((b) => b.value);
  prefs.gyms = ticked.length === data.gyms.length ? null : ticked;
  prefs.lockIn = LOCK_STEPS[Number($("lock-in").value)] ?? null;
  savePrefs(prefs);
  render();
}

function tickAll(on) {
  for (const b of gymBoxes()) b.checked = on;
  update();
}

function initForm() {
  const picked = new Set(selectedGyms().map((g) => g.id));
  $("gym-pick").append(
    ...data.gyms.map((g) => el("label", { class: "chip" },
      el("input", { type: "checkbox", value: g.id, checked: picked.has(g.id) }), g.name)),
    el("span", { class: "chip-actions" },
      el("button", { type: "button", class: "link", onclick: () => tickAll(true) }, "all"),
      " · ",
      el("button", { type: "button", class: "link", onclick: () => tickAll(false) }, "none")));
  $("freq-n").value = prefs.freq.n;
  $("freq-unit").value = prefs.freq.unit;
  $("tf-n").value = prefs.tf.n;
  $("tf-unit").value = prefs.tf.unit;
  $("lock-in").value = Math.max(0, LOCK_STEPS.indexOf(prefs.lockIn));
  if (prefs.lockIn !== null) $("calc-options").open = true;
  $("calc-form").addEventListener("input", update);
}

initForm();
render();
renderPerks();
renderFooter();
