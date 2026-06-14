#!/usr/bin/env python3
"""Mop-Up Yield — canonical paper book runner (Strategy 1).

Maintains a single shared $1,000 paper account in trading2/book.json. On each
run it: scans live Polymarket markets for heavy favorites (90-98.5c) that are
effectively decided but not yet resolved, SETTLES any held position whose market
has resolved (win -> redeem $1.00, loss -> $0), then DEPLOYS idle cash across the
best available favorites (one per event, diversified). Designed to be run on a
schedule (GitHub Actions) so the book keeps trading with no computer on.

No dependencies beyond the stdlib. Mirrors the selection logic in index.html.
"""
import json, re, ssl, time, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

GAMMA   = "https://gamma-api.polymarket.com"
BANKROLL= 1000.0
BOOK    = os.path.join(os.path.dirname(__file__), "book.json")
# mop-up universe gates (keep in sync with index.html)
PMIN, PMAX   = 0.90, 0.985
MIN_LIQ, MIN_V24 = 2000, 500
MIN_HRS, MAX_DAYS = 2, 45
TARGET_POS   = 16
PER_STAKE    = BANKROLL / TARGET_POS
PER_CAP      = 90.0
HOURLY_HINTS = ("up or down", " et)", "hourly")

ctx = ssl._create_unverified_context()


def corr_key(m):
    """A correlation key that groups all sub-markets of one underlying event
    (e.g. every Germany-vs-Curacao prop) so we never stack a single game.
    Polymarket slugs share a game prefix up to the date: fifwc-ger-kor-2026-06-14-*."""
    ev = m.get("events") or []
    base = (ev[0].get("slug") if ev and isinstance(ev[0], dict) else None) \
        or m.get("slug") or m.get("conditionId") or ""
    hit = re.match(r"(.+?\d{4}-\d{2}-\d{2})", base)
    return hit.group(1) if hit else base


def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    return json.loads(urllib.request.urlopen(r, timeout=30, context=ctx).read())


def ep(s):
    if not s:
        return 0
    try:
        return time.mktime(time.strptime(s.replace("Z", ""), "%Y-%m-%dT%H:%M:%S"))
    except Exception:
        return 0


def load_book():
    try:
        with open(BOOK) as f:
            b = json.load(f)
        b.setdefault("positions", []); b.setdefault("history", [])
        return b
    except Exception:
        return {"started": time.time(), "cash": BANKROLL, "positions": [], "history": []}


def fetch_universe():
    now = time.time(); out = []
    for off in range(0, 800, 100):
        try:
            d = get(f"{GAMMA}/markets?limit=100&offset={off}&active=true&closed=false"
                    f"&order=volume24hr&ascending=false")
        except Exception:
            break
        if not d:
            break
        for m in d:
            try:
                oc = json.loads(m.get("outcomes", "[]"))
                pr = [float(x) for x in json.loads(m.get("outcomePrices", "[]"))]
            except Exception:
                continue
            if len(pr) != 2 or not oc:
                continue
            q = m.get("question", "")
            if any(h in q.lower() for h in HOURLY_HINTS):
                continue
            end = ep(m.get("endDate")); hrs = (end - now) / 3600 if end else 0
            if not (MIN_HRS < hrs < MAX_DAYS * 24):
                continue
            liq = float(m.get("liquidityNum") or m.get("liquidity") or 0)
            v24 = float(m.get("volume24hr") or 0)
            if liq < MIN_LIQ or v24 < MIN_V24:
                continue
            fav = max(pr); oi = 0 if pr[0] >= pr[1] else 1
            if not (PMIN <= fav <= PMAX):
                continue
            days = hrs / 24; gross = (1 - fav) / fav
            out.append({"cid": m.get("conditionId"), "q": q, "outcome": oc[oi], "oi": oi,
                        "price": fav, "end": end, "days": days, "liq": liq, "apr": gross / days * 365,
                        "event": corr_key(m), "slug": m.get("slug")})
    out.sort(key=lambda c: c["apr"], reverse=True)
    return out


def market_by_cid(cid):
    try:
        d = get(f"{GAMMA}/markets?condition_ids={cid}")
        return d[0] if d else None
    except Exception:
        return None


def settle_and_mark(b):
    now = time.time(); still = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        mkts = list(ex.map(lambda p: market_by_cid(p["cid"]), b["positions"]))
    for p, m in zip(b["positions"], mkts):
        if not m:
            still.append(p); continue
        try:
            pr = [float(x) for x in json.loads(m.get("outcomePrices", "[]"))]
        except Exception:
            pr = []
        closed = m.get("closed") in (True, "true")
        if closed and len(pr) == 2 and (pr[0] >= 0.99 or pr[1] >= 0.99 or pr[0] <= 0.01 or pr[1] <= 0.01):
            won = pr[p["oi"]] >= 0.5
            payout = p["shares"] * 1 if won else 0
            b["cash"] += payout
            b["history"].insert(0, {"q": p["q"], "outcome": p["outcome"], "entry": p["entry"],
                                    "stake": p["stake"], "payout": payout, "pnl": payout - p["stake"],
                                    "win": won, "resolvedTs": now, "slug": p.get("slug")})
        else:
            p["cur"] = pr[p["oi"]] if len(pr) == 2 else p["entry"]
            p["end"] = ep(m.get("endDate")) or p["end"]
            still.append(p)
    b["positions"] = still


def deploy(b, universe):
    held_events = {p["event"] for p in b["positions"]}
    settled_slugs = {h.get("slug") for h in b["history"]}
    now = time.time()
    for c in universe:
        if b["cash"] < min(PER_STAKE, 10):
            break
        if len(b["positions"]) >= TARGET_POS:
            break
        if c["event"] in held_events:
            continue
        if c["slug"] in settled_slugs:                       # don't re-buy a market we already settled
            continue
        if any(p["cid"] == c["cid"] for p in b["positions"]):
            continue
        stake = min(PER_STAKE, PER_CAP, b["cash"])
        if stake < 10:
            break
        b["cash"] -= stake
        b["positions"].append({"cid": c["cid"], "q": c["q"], "outcome": c["outcome"], "oi": c["oi"],
                               "entry": c["price"], "cur": c["price"], "shares": stake / c["price"],
                               "stake": stake, "entryTs": now, "end": c["end"], "event": c["event"],
                               "slug": c["slug"]})
        held_events.add(c["event"])


def main():
    b = load_book()
    universe = fetch_universe()
    print(f"universe: {len(universe)} qualifying favorites", flush=True)
    settle_and_mark(b)
    deploy(b, universe)
    b["updated"] = time.time()
    inv = sum(p["shares"] * p.get("cur", p["entry"]) for p in b["positions"])
    realized = sum(h["pnl"] for h in b["history"])
    with open(BOOK, "w") as f:
        json.dump(b, f, separators=(",", ":"))
    print(f"book: equity ${b['cash']+inv:,.0f} | liquid ${b['cash']:,.0f} | invested ${inv:,.0f} "
          f"| {len(b['positions'])} open | realized ${realized:,.2f} | {len(b['history'])} settled",
          flush=True)


if __name__ == "__main__":
    main()
