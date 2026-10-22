const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function money(n) {
  if (!Number.isFinite(n)) return "–";
  const rounded = Math.round(n * 100) / 100;
  const s = Math.abs(rounded).toLocaleString("en-AU", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${rounded < 0 ? "−" : ""}$${s}`;
}

// "2026-10-23" -> "23 Oct 2026" (parsed by hand so time zones can't shift it)
export function date(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : String(iso);
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const period = (p) => (p && p.n > 0 ? plural(p.n, p.unit) : "");

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function planPrice(plan) {
  const price = money(Number(plan.price) || 0);
  switch (plan.kind) {
    case "casual":
      return `${price} / visit`;
    case "pack":
      return `${price} / ${plan.visits} visits (${money((Number(plan.price) || 0) / Math.max(1, Number(plan.visits) || 1))} each)` +
        (plan.expiry ? `, expires after ${period(plan.expiry)}` : "");
    case "prepaid":
      return `${price} upfront for ${period(plan.length)}`;
    case "recurring": {
      const every = plan.billing && plan.billing.n === 1 ? plan.billing.unit : period(plan.billing);
      const parts = [`${price} / ${every}`];
      if (plan.minTerm) parts.push(`min ${period(plan.minTerm)}`);
      if (Number(plan.upfront)) parts.push(`${money(Number(plan.upfront))} upfront`);
      return parts.join(", ");
    }
  }
  return price;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k in node && typeof v !== "string") node[k] = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
