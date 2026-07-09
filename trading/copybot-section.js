// shared renderer for the copy-bot books (paper on /trading, REAL MONEY on /live).
// P prefixes every element id; opts carries the per-book chrome; chip ids are
// optional (a page without a board just omits them). ?<P>Feed=<url> overrides
// the feed for local testing.
  // shared renderer for the two copy-bot books (paper + REAL MONEY): P prefixes
  // every element id, opts carries the per-book chrome. ?<P>Feed=<url> in the
  // query string overrides the feed for local testing.
  function copybotSection(P, FEED, opts){
    FEED=new URLSearchParams(location.search).get(P+"Feed")||FEED;
    const $=id=>document.getElementById(id);
    const money=n=>(n<0?"-$":"$")+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:Math.abs(n)>=100?0:2});
    const sgn=n=>(n>=0?"+":"")+money(n);
    const ageStr=s=>{s=Math.max(0,s);return s<90?Math.round(s)+"s":s<5400?Math.round(s/60)+"m":s<172800?Math.round(s/3600)+"h":Math.round(s/86400)+"d";};
    const timeStr=ts=>{if(!ts)return"—";const d=new Date(ts*1000);return d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" "+d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});};
    const relTd=ts=>!ts?'<td>—</td>':'<td title="'+timeStr(ts)+'">'+ageStr(Date.now()/1000-ts)+' ago</td>';
    const STAT={open:'<span class="pill" style="background:rgba(91,176,255,.13);color:var(--accent)">OPEN</span>',
                won:'<span class="pill buy">WON</span>',lost:'<span class="pill sell">LOST</span>',
                closed:'<span class="pill" style="background:rgba(139,155,176,.15);color:var(--dim)">SOLD</span>',
                sold:'<span class="pill" style="background:rgba(139,155,176,.15);color:var(--dim)">SOLD</span>',
                refund:'<span class="pill" style="background:rgba(245,196,81,.15);color:var(--amber)">REFUND 50/50</span>'};
    function offline(msg){const st=$(P+"Status");st.textContent=opts.offlinePill||"OFFLINE";
      st.className="pill "+(opts.offlineQuiet?"":"sell");$(P+"Meta").textContent=msg;
      const sb=$(opts.chipId); if(sb){sb.textContent="—";sb.className="bv";}
      const ss=$(opts.chipSubId); if(ss) ss.textContent=opts.offlineChipSub||"feed offline";
      $(P+"Bets").querySelector("tbody").innerHTML='<tr><td colspan="10" class="loading">'+msg+'</td></tr>';
      $(P+"Resolved").querySelector("tbody").innerHTML='<tr><td colspan="10" class="loading">—</td></tr>';
      $(P+"Missed").querySelector("tbody").innerHTML='<tr><td colspan="8" class="loading">—</td></tr>';
      $(P+"Alloc").querySelector("tbody").innerHTML='<tr><td colspan="6" class="loading">—</td></tr>';}
    function render(d){
      const age=Date.now()/1000-(d.updated||0);
      const st=$(P+"Status");
      st.textContent=d.mode==="live"?"LIVE · REAL $":"PAPER";
      st.className="pill buy";
      $(P+"Upd").textContent=(d.bets&&d.bets.length?"last bet activity ":"running · idle ")+ageStr(age)+" ago";
      const total=(d.cash||0)+(d.deployed||0)+(d.reserve||0), pnl=d.realized||0;
      $(P+"Equity").textContent=money(total);
      const sb=$(opts.chipId); if(sb){sb.textContent=money(total);sb.className="bv "+(pnl>=0?"green":"red");
        const ss=$(opts.chipSubId); if(ss) ss.textContent=sgn(pnl)+" realized · "+(d.open_count||0)+" open";}
      $(P+"Pnl").innerHTML='<span class="'+(pnl>=0?"green":"red")+'">'+sgn(pnl)+' realized P&amp;L</span>';
      $(P+"Cash").textContent=money(d.cash||0);
      $(P+"CashSub").textContent="of "+money(d.bankroll||1000)+" book";
      $(P+"Deployed").textContent=money(d.deployed||0);
      $(P+"Open").textContent=(d.open_count||0)+" open bets";
      const re=$(P+"Realized");re.textContent=sgn(pnl);re.className="sval "+(pnl>=0?"green":"red");
      const L=d.lag||{};
      $(P+"Lag").textContent=L.avg_s!=null?Math.round(L.avg_s)+"s":"—";
      $(P+"Slip").textContent=L.avg_slip_pct!=null?((L.avg_slip_pct*100).toFixed(1)+"% slip · "+(L.n24!=null?L.n24+" fills/24h":(L.n||0)+" copies")):"avg slippage";
      const sz=d.stake_pct?((d.stake_pct*100).toFixed(0)+"% of equity per bet (now $"+Math.round(d.stake||0)+")"):"$"+(d.stake||50)+" each";
      // ledger self-check straight from the feed: a broken book must be VISIBLE
      // on the dashboard, not hidden (drift = cash vs what the ledger implies;
      // adjustments = audited bookkeeping corrections, excluded from realized)
      const drift=d.ledger_drift||0, adj=d.adjustments||0;
      const ledger=(Math.abs(drift)>0.01?' · <span class="red">⚠ ledger drift '+sgn(drift)+'</span>'
                    :' · <span class="dim">ledger ✓</span>')
                   +(adj?' · <span class="dim">adjustments '+sgn(adj)+'</span>':'');
      $(P+"Meta").innerHTML=(d.bets||[]).length+" bets placed · "+sz+(d.event_cap?" · max "+d.event_cap+"/event":"")+" · free cash gates new bets · "+(d.wallets||[]).join(", ")+ledger;
      const FOLLOWED=new Set(d.wallets||[]);
      const CLS=d.classes||{};
      const whale=n=>CLS[n]==="whale"?' <span class="whale">🐋 whale</span>':'';
      const rowCls=b=>b.status==="won"?"rwon":b.status==="lost"?"rlost":b.status==="closed"?"rsold":b.status==="refund"?"rref":"";
      const betRow=b=>{
        const un=b.name&&!FOLLOWED.has(b.name);          // wallet no longer followed -> grey
        const slip=b.slippage_pct==null?"—":((b.slippage_pct>=0?"+":"")+(b.slippage_pct*100).toFixed(1)+"%");
        const pl=b.pnl==null?"—":'<span class="'+(b.pnl>=0?"green":"red")+'">'+sgn(b.pnl)+'</span>';
        const fee=b.fee!=null?money(b.fee):'<span class="dim">—</span>';
        return '<tr class="'+rowCls(b)+'"><td class="name'+(un?' unfollowed':'')+'" '+(un?'title="no longer followed"':'')+'>'+(b.name||"")+whale(b.name)+'</td>'+relTd(b.opened)
          +'<td class="mkt">'+(b.outcome?b.outcome+" · ":"")+(b.title||"")+'</td>'
          +'<td>'+Math.round((b.their_price||0)*100)+'¢</td><td>'+Math.round((b.my_price||0)*100)+'¢</td>'
          +'<td class="'+((b.slippage_pct||0)>0?"red":"green")+'">'+slip+'</td>'
          +'<td>'+money(b.cost||0)+'</td><td class="dim">'+fee+'</td>'
          +'<td>'+(STAT[b.status]||b.status)+'</td><td>'+pl+'</td></tr>';
      };
      const openBets=(d.bets||[]).filter(b=>b.status==="open"),
            resBets=(d.bets||[]).filter(b=>b.status!=="open");
      $(P+"BetsHead").textContent=`${opts.label||"Live bot"} — open bets (${openBets.length})`;
      $(P+"Bets").querySelector("tbody").innerHTML=openBets.map(betRow).join("")
        ||'<tr><td colspan="10" class="loading">no open bets — waiting for a new conviction trade from the wallets</td></tr>';
      const rw=resBets.filter(b=>b.status==="won").length, rl=resBets.filter(b=>b.status==="lost").length,
            rr=resBets.filter(b=>b.status==="refund").length, rs=resBets.filter(b=>b.status==="closed").length;
      $(P+"ResHead").textContent=`${opts.label||"Live bot"} — resolved bets (${resBets.length}${resBets.length?` · ${rw}W / ${rl}L${rr?` / ${rr}R`:''}${rs?` / ${rs}S`:''}`:''})`;
      $(P+"Resolved").querySelector("tbody").innerHTML=resBets.map(betRow).join("")
        ||'<tr><td colspan="10" class="loading">none settled yet</td></tr>';
      const missed=d.missed||[];
      const mp=d.missed_pnl||0;
      $(P+"MissHead").textContent=`${opts.label||"Live bot"} — missed bets (${missed.length}${missed.length?` · ${sgn(mp)} would-be`:''})`;
      $(P+"Missed").querySelector("tbody").innerHTML=missed.map(m=>{
        const pl=m.pnl==null?'<span class="dim">—</span>':'<span class="'+(m.pnl>=0?"green":"red")+'">'+sgn(m.pnl)+'</span>';
        const res=m.status==="open"?'<span class="pill" style="background:rgba(91,176,255,.13);color:var(--accent)">LIVE</span>':(STAT[m.status]||m.status);
        return '<tr><td class="name">'+(m.name||"")+whale(m.name)+'</td>'+relTd(m.ts)
          +'<td class="mkt">'+(m.outcome?m.outcome+" · ":"")+(m.title||"")+'</td>'
          +'<td>'+Math.round((m.price||0)*100)+'¢</td><td>'+money(m.stake||0)+'</td>'
          +'<td class="dim">'+(m.reason||"")+'</td><td>'+res+'</td><td>'+pl+'</td></tr>';
      }).join("")||'<tr><td colspan="8" class="loading">none — the bot has taken every qualifying bet so far</td></tr>';
      // per-wallet allocation, aggregated from the placed bets in the feed
      const agg={}; (d.wallets||[]).forEach(n=>agg[n]={addr:null,bets:0,w:0,l:0,r:0,s:0,inv:0,real:0});
      for(const b of d.bets||[]){
        const a=agg[b.name]||(agg[b.name]={addr:null,bets:0,w:0,l:0,r:0,s:0,inv:0,real:0});
        a.addr=a.addr||b.wallet; a.bets++;
        if(b.status==="open") a.inv+=b.cost||0;
        else if(b.status==="won"){a.w++; a.real+=b.pnl||0;}
        else if(b.status==="lost"){a.l++; a.real+=b.pnl||0;}
        else if(b.status==="refund"){a.r++; a.real+=b.pnl||0;}
        else if(b.pnl!=null){a.s++; a.real+=b.pnl;}         // mirror-sold with recorded P&L
      }
      $(P+"Alloc").querySelector("tbody").innerHTML=Object.entries(agg).map(([n,a])=>{
        const nm=a.addr?`<a href="https://polymarket.com/profile/${a.addr}" target="_blank">${n}</a>`:n;
        const un=!FOLLOWED.has(n);
        const nn=a.w+a.l, wp=nn?Math.round(100*a.w/nn)+"%":'<span class="dim">—</span>';
        return `<tr><td class="name${un?' unfollowed':''}">${nm}${whale(n)}${un?' <span style="font-size:10px">· unfollowed</span>':''}</td><td>${a.bets}</td><td>${wp}</td>`
          +`<td>${recCell(a.w,a.l,a.r,a.s)}</td>`
          +`<td>${money(a.inv)}</td><td class="${a.real>=0?'green':'red'}">${sgn(a.real)}</td></tr>`;
      }).join("")||'<tr><td colspan="6" class="loading">no bets yet</td></tr>';
    }
    function load(){fetch(FEED,{cache:"no-store"}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(render)
      .catch(()=>offline(opts.offlineMsg));}
    load();setInterval(load,30000);
  }

// shared record cell: W–L +NR +NS (used by the alloc tables here and the
// sharps table on /trading — single definition, both pages load this file)
const recCell = (w,l,rf,sd) => (w+l+((rf||0)+(sd||0))) ? `${w}\u2013${l}`+(rf?` <span class="amber">+${rf}R</span>`:'')+(sd?` <span class="dim">+${sd}S</span>`:'') : '<span class="dim">\u2014</span>';
