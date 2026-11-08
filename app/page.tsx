"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Sticker = { id: string; name: string; rarity: string; image_url: string };
type Profile = { id: string; username: string; role: string };
type BoardRow = { username: string; total: number; legendary: number };

export default function Home() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastDrop, setLastDrop] = useState<Sticker | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [inventory, setInventory] = useState<Sticker[]>([]);
  const [pity, setPity] = useState(0);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("id,username,role").eq("id", userId).single();
    if (data) { setProfile(data); setUsername(data.username); }
  }
  async function refresh() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSessionUser(null); setProfile(null); return; }
    setSessionUser(auth.user);
    await loadProfile(auth.user.id);
    const [{ data: inv }, { data: stats }] = await Promise.all([
      supabase.from("collections").select("stickers(id,name,rarity,image_url)").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("pity_count").eq("id", auth.user.id).single()
    ]);
    setInventory((inv || []).map((x: any) => x.stickers).filter(Boolean));
    setPity(stats?.pity_count || 0);
  }
  async function refreshBoard() {
    const { data } = await supabase.from("leaderboard").select("username,total,legendary").order("total", { ascending: false }).limit(25);
    setBoard((data || []) as BoardRow[]);
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) { setSessionUser(data.session.user); loadProfile(data.session.user.id); refresh(); }
    });
    refreshBoard();
    const channel = supabase.channel("leaderboard-live").on("postgres_changes", { event: "*", schema: "public", table: "collections" }, refreshBoard).subscribe();
    const timer = setInterval(refreshBoard, 12000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, []);

  async function authenticate() {
    setBusy(true); setMessage("");
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,18}$/.test(clean)) { setMessage("Username must be 3–18 characters: letters, numbers or underscore."); setBusy(false); return; }
    // Username login is implemented as a private email alias; no real email is collected.
    const email = `${clean}@login.stickerrush.com`;
    const result = isRegister
      ? await supabase.auth.signUp({ email, password, options: { data: { username: clean } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (result.data.user) {
      setSessionUser(result.data.user);
      await loadProfile(result.data.user.id);
      setMessage(isRegister ? "Account created! Welcome to Sticker Rush." : "Welcome back!");
      await refresh();
    }
    setBusy(false);
  }
  async function spin() {
    if (busy || spinning) return;
    setBusy(true); setSpinning(true); setLastDrop(null); setMessage("");
    const { data, error } = await supabase.rpc("spin_sticker");
    if (error) { setMessage(error.message); setSpinning(false); setBusy(false); return; }
    const result = data as any;
    setTimeout(async () => {
      setLastDrop(result.sticker);
      setPity(result.pity_count);
      await refresh(); await refreshBoard();
      setSpinning(false); setBusy(false);
    }, 2300);
  }
  async function logout() { await supabase.auth.signOut(); setSessionUser(null); setProfile(null); setInventory([]); setLastDrop(null); }

  const next = pity >= 49 ? "GUARANTEED LEGENDARY" : (pity + 1) % 10 === 0 ? "10% LEGENDARY BOOST" : `${50 - pity} spins until guarantee`;
  const counts = useMemo(() => ({
    rare: inventory.filter(s => s.rarity === "rare").length,
    epic: inventory.filter(s => s.rarity === "epic").length,
    legendary: inventory.filter(s => s.rarity === "legendary").length
  }), [inventory]);

  return <main className="shell">
    <header className="top"><a className="brand" href="#">✦ STICKER RUSH</a><span className="live">● LIVE GAME</span></header>
    {!sessionUser ? <section className="auth panel">
      <div className="eyebrow">THE STICKER SUMMONING GAME</div><h1>Spin for<br/><span>something legendary.</span></h1>
      <p className="muted">Create a username, spin the wheel and climb the global leaderboard.</p>
      <div className="tabs"><button className={isRegister ? "selected" : ""} onClick={() => setIsRegister(true)}>Create account</button><button className={!isRegister ? "selected" : ""} onClick={() => setIsRegister(false)}>Log in</button></div>
      <label>USERNAME</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. shadow_07" maxLength={18}/>
      <label>PASSWORD</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" onKeyDown={e => e.key === "Enter" && authenticate()}/>
      <button className="primary full" disabled={busy || password.length < 8} onClick={authenticate}>{busy ? "PLEASE WAIT…" : isRegister ? "CREATE PLAYER ACCOUNT →" : "LOG IN →"}</button>
      {message && <p className="notice">{message}</p>}
      <p className="tiny">Username is public on the leaderboard. Never reuse an important password.</p>
    </section> : <><section className="welcome"><div><div className="eyebrow">WELCOME BACK</div><h1>{profile?.username || username}</h1><p className="muted">Your collection is waiting.</p></div><div className="actions">{profile?.role === "admin" && <a className="adminLink" href="/admin">ADMIN PANEL ↗</a>}<button className="ghost" onClick={logout}>LOG OUT</button></div></section>
      <section className="gameGrid">
        <div className="panel wheelPanel">
          <div className="eyebrow">THE SUMMONING WHEEL</div><h2>One spin. One sticker.</h2>
          <div className={`wheel ${spinning ? "animate" : ""}`}><div className="wheelInner"><span>✦</span><b>{spinning ? "SUMMONING" : "SPIN"}</b><small>YOUR LUCK AWAITS</small></div></div>
          <div className="odds"><span>⚪ RARE <b>{(pity + 1) % 10 === 0 || pity >= 49 ? "60%" : "66%"}</b></span><span>🟣 EPIC <b>{(pity + 1) % 10 === 0 || pity >= 49 ? "30%" : "33%"}</b></span><span>🟡 LEGENDARY <b>{pity >= 49 ? "100%" : (pity + 1) % 10 === 0 ? "10%" : "1%"}</b></span></div>
          <button className="primary full spinButton" disabled={busy || inventory.length < 0} onClick={spin}>{spinning ? "THE WHEEL IS TURNING…" : "✦ SPIN NOW"}</button>
          <div className="pity"><span>LEGENDARY PITY</span><b>{pity}/50</b><div className="bar"><i style={{width: `${Math.min(100,pity*2)}%`}}/></div><small>{next}</small></div>
          {message && <p className="notice">{message}</p>}
        </div>
        <div className="side">
          <div className="panel reveal"><div className="eyebrow">LATEST DROP</div>{lastDrop ? <div className={`drop ${lastDrop.rarity}`}><img src={lastDrop.image_url} alt={lastDrop.name}/><h2>{lastDrop.name}</h2><span>{lastDrop.rarity.toUpperCase()}</span></div> : <div className="emptyDrop">✧<p>Your next sticker reveal appears here.</p></div>}</div>
          <div className="panel"><div className="eyebrow">YOUR COLLECTION</div><div className="stats"><div><b>{inventory.length}</b><span>TOTAL</span></div><div><b>{counts.rare}</b><span>RARE</span></div><div><b>{counts.epic}</b><span>EPIC</span></div><div><b>{counts.legendary}</b><span>LEGENDARY</span></div></div><div className="miniInventory">{inventory.slice(0,8).map((s,i)=><img key={i} src={s.image_url} title={`${s.name} (${s.rarity})`} alt={s.name}/>)}</div></div>
        </div>
      </section>
    </>}
    <section className="panel leaderboard"><div className="leaderHead"><div><div className="eyebrow">THE GLOBAL RANKINGS</div><h2>🏆 Top collectors</h2></div><span className="live">● UPDATING LIVE</span></div>
      {board.length ? <div className="board">{board.map((p,i)=><div className="boardRow" key={p.username}><span className="rank">{String(i+1).padStart(2,"0")}</span><b>{p.username}</b><span className="legendCount">✦ {p.legendary} legendary</span><strong>{p.total} <small>stickers</small></strong></div>)}</div> : <p className="muted">The leaderboard will appear when the first players collect stickers.</p>}
    </section>
    <footer>STICKER RUSH <span>SPIN • COLLECT • DOMINATE</span></footer>
  </main>;
}
