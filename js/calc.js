// Pure cost maths. All costs are over a timeframe of `tf` days for a given
// number of visits, spread evenly across it.

export const UNIT_DAYS = { day: 1, week: 7, month: 365.25 / 12, year: 365.25 };

export const days = (p) => (p && p.n > 0 ? p.n * UNIT_DAYS[p.unit] : 0);

// Guard against float noise: 365.25 / 30.4375 should be exactly 12.
const ceil = (x) => Math.ceil(x - 1e-9);

export function planCost(plan, visits, tf, settings) {
  if (visits <= 0) return 0;
  const price = Number(plan.price) || 0;
  switch (plan.kind) {
    case "casual":
      return price * visits;
    case "pack": {
      const size = Math.max(1, Number(plan.visits) || 1);
      const expiry = days(plan.expiry);
      if (!expiry) {
        return settings.keepPackLeftovers ? (price * visits) / size : price * ceil(visits / size);
      }
      // One or more packs per expiry window you climb in; leftovers expire.
      const windows = Math.min(ceil(tf / expiry), visits);
      return price * windows * ceil(visits / windows / size);
    }
    case "prepaid": {
      const len = days(plan.length);
      return len ? price * ceil(tf / len) : Infinity;
    }
    case "recurring": {
      const billing = days(plan.billing);
      if (!billing) return Infinity;
      const paidFor = Math.max(tf, days(plan.minTerm));
      return (Number(plan.upfront) || 0) + price * ceil(paidFor / billing);
    }
  }
  return Infinity;
}

// Yearly expected store/food spend × discount, scaled to the timeframe.
export function perkSavings(data, tf) {
  const yearly = [...data.stores, ...data.food].reduce(
    (sum, s) => sum + ((Number(s.discountPct) || 0) / 100) * (Number(s.expectedSpend) || 0),
    0,
  );
  return (yearly * tf) / UNIT_DAYS.year;
}

export function socCost(data, gym, visits, tf) {
  if (visits <= 0) return 0;
  const len = days(data.membership.length) || UNIT_DAYS.year;
  return data.membership.fee * ceil(tf / len) + gym.socPrice * visits - perkSavings(data, tf);
}

export const SOC_ID = "soc";

// Every way to pay at this gym, cheapest first. The soc option is included.
export function options(data, gym, visits, tf) {
  const list = [
    { id: SOC_ID, label: "BoulderSoc member", cost: socCost(data, gym, visits, tf) },
    ...gym.plans.map((p) => ({ id: p.id, label: p.label, plan: p, cost: planCost(p, visits, tf, data.settings) })),
  ];
  return list.sort((a, b) => a.cost - b.cost);
}

const bestOther = (data, gym, visits, tf) =>
  gym.plans.reduce((best, p) => {
    const cost = planCost(p, visits, tf, data.settings);
    return cost < best.cost ? { plan: p, cost } : best;
  }, { plan: null, cost: Infinity });

// The visit counts (over the timeframe) where the soc membership is the
// cheapest option. Scans 1..one visit a day, which handles the steps that
// packs and fixed-length memberships create.
export function socRange(data, gym, tf) {
  const maxVisits = Math.max(1, Math.floor(tf));
  let min = null;
  let max = null;
  for (let v = 1; v <= maxVisits; v++) {
    if (socCost(data, gym, v, tf) < bestOther(data, gym, v, tf).cost - 1e-6) {
      if (min === null) min = v;
      max = v;
    }
  }
  const capped = max === maxVisits;
  const beatenBy = max !== null && !capped ? bestOther(data, gym, max + 1, tf).plan : null;
  return { min, max, capped, beatenBy };
}

// `some`: visits where the membership is cheapest at one gym or more (the union).
// `every`: visits where it's cheapest at every gym (the overlap), or null if none.
// Assumes each gym's winning visits are one unbroken run, which holds for the
// shapes of plan here (soc cost rises steadily; memberships are flat).
export function overallRange(data, tf, gyms = data.gyms) {
  const all = gyms.map((g) => socRange(data, g, tf));
  const ranges = all.filter((r) => r.min !== null);
  if (!ranges.length) return null;
  const some = {
    min: Math.min(...ranges.map((r) => r.min)),
    max: Math.max(...ranges.map((r) => r.max)),
    capped: ranges.some((r) => r.capped),
  };
  let every = null;
  if (ranges.length === all.length) {
    const min = Math.max(...ranges.map((r) => r.min));
    const max = Math.min(...ranges.map((r) => r.max));
    if (min <= max) every = { min, max, capped: ranges.every((r) => r.capped) };
  }
  return { some, every };
}

export const casualPlan = (gym) => gym.plans.find((p) => p.kind === "casual");
