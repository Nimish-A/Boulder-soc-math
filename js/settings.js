import { loadData, saveData, resetData, isValidData, defaultData } from "./store.js";
import { el, date } from "./format.js";

let data = loadData();
const root = document.getElementById("settings");
const status = document.getElementById("status");

const UNITS = ["week", "month", "year"];
const KINDS = { casual: "Casual entry", pack: "Multi-visit pass", prepaid: "Prepaid membership", recurring: "Recurring membership" };
const AUDIENCES = ["student", "concession", "adult", "all"];

let statusTimer;
function save(message = "Saved on this device.") {
  const ok = saveData(data);
  status.textContent = ok ? message : "Couldn't save: browser storage is blocked. Changes will be lost on reload.";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.textContent = ""), 2500);
}

const uid = () => Math.random().toString(36).slice(2, 9);

// ---------- field builders ----------
// `owner` gets `edited = true` (or owner[flag]) when the value changes, so the
// calculator can show "edited locally" instead of the checked date.

function field(label, obj, key, { type = "number", step = "any", owner, flag = "edited", wide, rerender, placeholder } = {}) {
  const input = el("input", { type, step: type === "number" ? step : null, placeholder });
  input.value = obj[key] ?? "";
  input.addEventListener("input", () => {
    obj[key] = type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
    if (owner) owner[flag] = true;
    save();
    if (rerender) render();
  });
  return el("label", { class: `field${wide ? " wide" : ""}` }, label, input);
}

function check(label, obj, key) {
  const input = el("input", { type: "checkbox", checked: !!obj[key] });
  input.addEventListener("change", () => { obj[key] = input.checked; save(); });
  return el("label", { class: "field check" }, input, label);
}

function select(label, obj, key, choices, { owner, rerender } = {}) {
  const s = el("select", {}, Object.entries(choices).map(([v, t]) => el("option", { value: v }, t)));
  s.value = obj[key] ?? "";
  s.addEventListener("change", () => {
    obj[key] = s.value;
    if (owner) owner.edited = true;
    save();
    if (rerender) render();
  });
  return el("label", { class: "field" }, label, s);
}

// A {n, unit} value. With allowNone, a blank number means "none" (null).
function periodField(label, obj, key, { allowNone, owner } = {}) {
  const value = obj[key];
  const n = el("input", { type: "number", min: "0", step: "1" });
  n.value = value ? value.n : "";
  if (allowNone) n.placeholder = "none";
  const unit = el("select", {}, UNITS.map((u) => el("option", { value: u }, `${u}(s)`)));
  unit.value = value ? value.unit : "month";
  const update = () => {
    obj[key] = n.value === "" || Number(n.value) <= 0 ? (allowNone ? null : { n: 1, unit: unit.value }) : { n: Number(n.value), unit: unit.value };
    if (owner) owner.edited = true;
    save();
  };
  n.addEventListener("input", update);
  unit.addEventListener("change", update);
  return el("label", { class: "field" }, label, el("span", { class: "period" }, n, unit));
}

function linesField(label, obj, key) {
  const t = el("textarea", { rows: 3 });
  t.value = (obj[key] || []).join("\n");
  t.addEventListener("input", () => {
    obj[key] = t.value.split("\n").map((s) => s.trim()).filter(Boolean);
    save();
  });
  return el("label", { class: "field wide" }, label, t);
}

const button = (text, onclick, cls) => el("button", { type: "button", class: cls, onclick }, text);

// ---------- sections ----------

function generalSection() {
  return el("section", { class: "panel" },
    el("h2", {}, "General"),
    el("div", { class: "fields" },
      field("Soc membership fee ($)", data.membership, "fee", { owner: data.membership }),
      periodField("Membership lasts", data.membership, "length", { owner: data.membership }),
      periodField("Default timeframe", data.settings, "timeframe"),
      check("Unused visits on a pass with no expiry keep their value", data.settings, "keepPackLeftovers")),
    el("p", { class: "muted small" },
      "With that box ticked, 3 visits on a $216 10-pass counts as $64.80, because the rest carry over. Untick it to count the whole pass."));
}

function planEditor(gym, plan, index) {
  const fields = [
    field("Name", plan, "label", { type: "text" }),
    select("Type", plan, "kind", KINDS, { owner: plan, rerender: true }),
    field("Price ($)", plan, "price", { owner: plan }),
  ];
  if (plan.kind === "pack") {
    fields.push(field("Visits", plan, "visits", { step: "1", owner: plan }));
    fields.push(periodField("Expires after", plan, "expiry", { allowNone: true, owner: plan }));
  }
  if (plan.kind === "prepaid") fields.push(periodField("Length", plan, "length", { owner: plan }));
  if (plan.kind === "recurring") {
    fields.push(periodField("Billed every", plan, "billing", { owner: plan }));
    fields.push(periodField("Minimum term", plan, "minTerm", { allowNone: true, owner: plan }));
    fields.push(field("Upfront ($)", plan, "upfront", { owner: plan }));
  }
  fields.push(select("Price for", plan, "audience", Object.fromEntries(AUDIENCES.map((a) => [a, a]))));
  fields.push(field("Source URL", plan, "source", { type: "url", wide: true, placeholder: gym.source ? `Uses the gym's: ${gym.source}` : "" }));
  fields.push(button("Remove plan", () => {
    gym.plans.splice(index, 1);
    save("Plan removed.");
    render();
  }, "link danger"));

  const meta = plan.edited ? "edited locally" : plan.checked ? `checked ${date(plan.checked)}` : "";
  return el("div", { class: "plan-edit" },
    el("div", { class: "fields" }, fields),
    meta ? el("p", { class: "muted small" }, meta) : null);
}

// Defaults for each plan type. The future plan builder can start from these.
function newPlan(gym) {
  return { id: `${gym.id}-${uid()}`, kind: "casual", label: "New plan", price: 0, audience: "student",
    visits: 10, expiry: null, length: { n: 1, unit: "month" }, billing: { n: 1, unit: "week" },
    minTerm: null, upfront: 0, edited: true };
}

function gymEditor(gym, index, openIds) {
  return el("details", { class: "panel gym-edit", id: `edit-${gym.id}`, open: openIds.has(`edit-${gym.id}`) },
    el("summary", {}, gym.name || "Unnamed gym"),
    el("div", { class: "fields" },
      field("Name", gym, "name", { type: "text" }),
      field("Soc price ($/visit)", gym, "socPrice", { owner: gym, flag: "socEdited" }),
      field("Soc price note", gym, "socNote", { type: "text", wide: true }),
      check("Uni ID needed", gym, "requiresUniId"),
      field("Default source URL", gym, "source", { type: "url", wide: true }),
      linesField("Notes (one per line, not counted in the maths)", gym, "notes")),
    el("h3", { style: "margin-top:14px" }, "Plans"),
    gym.plans.map((p, i) => planEditor(gym, p, i)),
    el("div", { class: "row-actions" },
      button("Add plan", () => {
        gym.plans.push(newPlan(gym));
        save("Plan added.");
        render();
      }),
      button("Remove gym", () => {
        if (!confirm(`Remove ${gym.name}?`)) return;
        data.gyms.splice(index, 1);
        save("Gym removed.");
        render();
      }, "danger")));
}

function gymsSection(openIds) {
  return el("section", {},
    el("h2", {}, "Gyms"),
    data.gyms.map((g, i) => gymEditor(g, i, openIds)),
    el("div", { class: "row-actions" },
      button("Add gym", () => {
        const id = `gym-${uid()}`;
        data.gyms.push({ id, name: "New gym", requiresUniId: false, socPrice: 0, socNote: "", source: "", notes: [],
          plans: [{ ...newPlan({ id }), label: "Casual entry" }] });
        save("Gym added.");
        render(new Set([`edit-${id}`]));
      })));
}

function perkList(title, list) {
  return el("div", { class: "panel" },
    el("h3", {}, title),
    list.map((s, i) => el("div", { class: "fields plan-edit" },
      field("Name", s, "name", { type: "text" }),
      field("Discount (%)", s, "discountPct"),
      field("Your expected spend ($/year)", s, "expectedSpend"),
      button("Remove", () => { list.splice(i, 1); save("Removed."); render(); }, "link danger"))),
    el("div", { class: "row-actions" },
      button("Add", () => { list.push({ name: "New", discountPct: 10, expectedSpend: 0 }); save("Added."); render(); })));
}

function perksSection() {
  return el("section", { id: "perks" },
    el("h2", {}, "Stores & food"),
    el("p", { class: "muted small" }, "Expected spend × discount is taken off the membership's cost in the maths."),
    perkList("Stores", data.stores),
    perkList("Food", data.food));
}

function dataSection() {
  const fileInput = el("input", { type: "file", accept: "application/json,.json", hidden: true });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidData(parsed)) throw new Error("not a BoulderSoc data file");
      data = parsed;
      save("Imported.");
      render();
    } catch (e) {
      status.textContent = `Import failed: ${e.message}`;
    }
    fileInput.value = "";
  });

  return el("section", { class: "panel" },
    el("h2", { style: "margin-top:0" }, "Your data"),
    el("p", { class: "muted small" }, "Export to share your edits or move them to another device."),
    el("div", { class: "row-actions" },
      button("Export JSON", () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = el("a", { href: URL.createObjectURL(blob), download: "bouldersoc-data.json" });
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      }),
      button("Import JSON", () => fileInput.click()),
      button("Reset to defaults", () => {
        if (!confirm("Discard all local edits and go back to the default prices?")) return;
        resetData();
        data = defaultData();
        status.textContent = "Reset to defaults.";
        render();
      }, "danger"),
      fileInput));
}

function render(openIds) {
  const open = openIds || new Set([...root.querySelectorAll("details[open]")].map((d) => d.id));
  root.replaceChildren(generalSection(), gymsSection(open), perksSection(), dataSection());
}

render();
if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
