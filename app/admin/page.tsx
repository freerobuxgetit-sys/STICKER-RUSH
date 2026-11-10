"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = { id: string; username: string; role: string; is_banned: boolean };
type Odds = { rare: string; epic: string; legendary: string; secret: string };
const DEFAULT_ODDS: Odds = { rare: "65.5", epic: "33.3", legendary: "1", secret: "0.2" };

export default function Admin() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rarity, setRarity] = useState("rare");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [msg, setMsg] = useState("");
  const [odds, setOdds] = useState<Odds>(DEFAULT_ODDS);
  const [oddsMode, setOddsMode] = useState("own");
  const [oddsMsg, setOddsMsg] = useState("");
  const [oddsBusy, setOddsBusy] = useState(false);
  const [prices, setPrices] = useState({ rare: "60", epic: "120", legendary: "240" });
  const [shopMsg, setShopMsg] = useState("");
  const [rewardTarget, setRewardTarget] = useState("self");
  const [rewardAmount, setRewardAmount] = useState("100");
  const [rewardMsg, setRewardMsg] = useState("");
  const [giftAmount, setGiftAmount] = useState("500");
  const [giftMessage, setGiftMessage] = useState("Happy Diwali! 🪔");
  const [giftStart, setGiftStart] = useState("");
  const [giftEnd, setGiftEnd] = useState("");
  const [giftMsg, setGiftMsg] = useState("");

  async function loadOdds(mode = oddsMode) {
    const { data, error } = await supabase.rpc("get_my_spin_odds");
    if (error) { setOddsMsg(error.message); return; }
    const selected = mode === "all" ? data?.global_odds : data?.own_odds;
    setOdds(selected ? { rare: String(selected.rare), epic: String(selected.epic), legendary: String(selected.legendary), secret: String(selected.secret) } : DEFAULT_ODDS);
  }

  async function saveOdds() {
    const values = { rare: Number(odds.rare), epic: Number(odds.epic), legendary: Number(odds.legendary), secret: Number(odds.secret) };
    if (Object.values(values).some(v => !Number.isFinite(v) || v < 0 || v > 100) || Math.round((values.rare + values.epic + values.legendary + values.secret) * 100) !== 10000) {
      setOddsMsg("Enter valid percentages that total exactly 100%."); return;
    }
    setOddsBusy(true); setOddsMsg("Saving…");
    const { error } = await supabase.rpc("save_spin_odds", { target_scope: oddsMode, new_odds: values });
    setOddsBusy(false);
    setOddsMsg(error ? error.message : oddsMode === "all" ? "Custom odds saved for all players." : "Custom odds saved for your spins.");
  }

  async function resetOdds() {
    setOddsBusy(true); setOddsMsg("Resetting…");
    const { error } = await supabase.rpc("reset_spin_odds", { target_scope: oddsMode });
    setOddsBusy(false);
    if (error) { setOddsMsg(error.message); return; }
    setOdds(DEFAULT_ODDS); setOddsMsg("Custom odds removed. Default odds are active.");
  }

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("Log in with your admin account first."); setAllowed(false); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile?.role !== "admin") { setMsg("Access denied. This account is not an admin."); setAllowed(false); setLoading(false); return; }
    setAllowed(true);
    const { data: stickers, error: stickerError } = await supabase.from("stickers").select("*").order("created_at", { ascending: false });
    if (stickerError) setMsg(stickerError.message); else setItems(stickers || []);
    const { data: playerData, error: playerError } = await supabase.rpc("admin_list_players");
    if (playerError) setMsg(playerError.message); else setPlayers(playerData || []);
    await loadOdds();
    const { data: shopData, error: shopError } = await supabase.rpc("get_hd_shop_prices");
    if (shopError) setShopMsg(shopError.message);
    else if (shopData) setPrices({ rare: String(shopData.rare), epic: String(shopData.epic), legendary: String(shopData.legendary) });
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function changeRole(username: string, role: string) {
    const { error } = await supabase.rpc("admin_set_role", { target_username: username, new_role: role });
    if (error) { setMsg(error.message); return; }
    setMsg(`${username} is now ${role}.`); await load();
  }

  async function changeBan(username: string, banned: boolean) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) { setMsg("Please log in again."); return; }
    const response = await fetch("/api/admin/ban", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ username, banned }) });
    const result = await response.json();
    if (!response.ok) { setMsg(result.error || "Ban operation failed."); return; }
    setMsg(banned ? `${username} has been banned.` : `${username} has been unbanned.`); await load();
  }

  async function savePrices() {
    const values = [Number(prices.rare), Number(prices.epic), Number(prices.legendary)];
    if (values.some(v => !Number.isInteger(v) || v < 0)) { setShopMsg("Enter whole-number prices of 0 HD or more."); return; }
    const { data, error } = await supabase.rpc("admin_set_hd_shop_prices", { new_rare: values[0], new_epic: values[1], new_legendary: values[2] });
    setShopMsg(error ? error.message : `Prices saved: Rare ${data.rare}, Epic ${data.epic}, Legendary ${data.legendary} HD.`);
  }

  async function rewardHD() {
    const amount = Number(rewardAmount);
    if (!Number.isInteger(amount) || amount <= 0) { setRewardMsg("Enter a whole number greater than zero."); return; }
    const target = rewardTarget === "self" ? (await supabase.auth.getUser()).data.user?.id : rewardTarget;
    if (!target) { setRewardMsg("Could not identify the selected account."); return; }
    let targetName = "";
    if (rewardTarget === "self") {
      const { data } = await supabase.from("profiles").select("username").eq("id", target).single();
      targetName = data?.username || "";
    } else targetName = players.find(p => p.id === target)?.username || "";
    const { data, error } = await supabase.rpc("admin_reward_hd", { target_username: targetName, reward_amount: amount });
    setRewardMsg(error ? error.message : `Rewarded ${amount} HD to ${targetName}. New balance: ${data.hd_balance} HD.`);
  }

  async function sendGift() {
    if (!giftStart || !giftEnd) { setGiftMsg("Choose both the start and end date/time."); return; }
    const amount = Number(giftAmount);
    if (!Number.isInteger(amount) || amount <= 0) { setGiftMsg("Gift amount must be a whole number greater than zero."); return; }
    const { data, error } = await supabase.rpc("admin_create_hd_gift", {
      gift_message: giftMessage, gift_amount: amount,
      gift_starts_at: new Date(giftStart).toISOString(), gift_ends_at: new Date(giftEnd).toISOString()
    });
    setGiftMsg(error ? error.message : `Gift created! ${data.amount} HD per player, available until ${new Date(data.ends_at).toLocaleString()}.`);
  }

  async function upload() {
    if (!file || !name.trim()) { setMsg("Add a sticker name and image."); return; }
    setMsg("Uploading…");
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("stickers").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) { setMsg(upErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("stickers").getPublicUrl(path);
    const { error } = await supabase.from("stickers").insert({ name: name.trim(), rarity, image_url: publicUrl, storage_path: path });
    if (error) { setMsg(error.message); return; }
    setName(""); setFile(null); setMsg("Sticker added successfully!"); await load();
  }

  async function remove(id: string, path: string) {
    if (!confirm("Delete this sticker?")) return;
    const { error } = await supabase.from("stickers").delete().eq("id", id);
    if (error) { setMsg(error.message); return; }
    if (path) {
      const { error: storageError } = await supabase.storage.from("stickers").remove([path]);
      if (storageError) { setMsg(`Sticker deleted, but image cleanup failed: ${storageError.message}`); await load(); return; }
    }
    setMsg("Sticker deleted."); await load();
  }

  if (loading) return <main className="shell"><p>Checking admin access…</p></main>;

  return <main className="shell">
    <header className="top"><a className="brand" href="/">✦ STICKER RUSH</a><a className="ghost" href="/">← BACK TO GAME</a></header>
    <section className="panel adminPanel">
      <div className="eyebrow">CONTROL ROOM</div><h1>Sticker <span>Admin</span></h1>
      {!allowed ? <p className="notice">{msg}</p> : <>
        <h2>Spin odds control</h2>
        <p className="muted">Custom odds override normal, milestone and pity odds.</p>
        <label>APPLY CUSTOM ODDS TO
          <select value={oddsMode} onChange={e => { setOddsMode(e.target.value); void loadOdds(e.target.value); }}>
            <option value="own">Own Spins</option><option value="all">All Players</option>
          </select>
        </label>
        <div className="formGrid">{(["rare", "epic", "legendary", "secret"] as const).map(key => <label key={key}>{key.toUpperCase()} CHANCE (%)<input type="number" min="0" max="100" step="0.1" value={odds[key]} onChange={e => setOdds(current => ({ ...current, [key]: e.target.value }))} /></label>)}</div>
        <p className="muted">Total: {(Number(odds.rare) + Number(odds.epic) + Number(odds.legendary) + Number(odds.secret)).toFixed(2)}% · Must equal 100%</p>
        <button className="primary" onClick={saveOdds} disabled={oddsBusy}>{oddsBusy ? "PLEASE WAIT…" : "SAVE ODDS"}</button>
        <button className="ghost" onClick={resetOdds} disabled={oddsBusy}>RESET TO DEFAULT</button>
        {oddsMsg && <p className="notice">{oddsMsg}</p>}
        <p className="tiny">Own Spins affects only your account. All Players applies globally, except players with their own custom odds.</p>

        <h2>💎 HD Shop prices</h2>
        <p className="muted">These prices apply to every player. Pack contents: 3 Rare, 3 Epic, or 1 Legendary sticker.</p>
        <div className="formGrid">
          {(["rare", "epic", "legendary"] as const).map(key => <label key={key}>{key.toUpperCase()} PACK PRICE (HD)
            <input type="number" min="0" step="1" value={prices[key]} onChange={e => setPrices(p => ({ ...p, [key]: e.target.value }))} />
          </label>)}
        </div>
        <button className="primary" onClick={savePrices}>SAVE SHOP PRICES</button>
        {shopMsg && <p className="notice">{shopMsg}</p>}

        <h2>🎁 Send an occasion Gift Box</h2>
        <p className="muted">Every account can claim this fixed HD amount once during the availability window, including accounts registered after you create it.</p>
        <div className="formGrid">
          <label>HD PER PLAYER<input type="number" min="1" step="1" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} /></label>
          <label>GIFT MESSAGE<input value={giftMessage} maxLength={240} onChange={e => setGiftMessage(e.target.value)} /></label>
          <label>AVAILABLE FROM<input type="datetime-local" value={giftStart} onChange={e => setGiftStart(e.target.value)} /></label>
          <label>AVAILABLE UNTIL<input type="datetime-local" value={giftEnd} onChange={e => setGiftEnd(e.target.value)} /></label>
        </div>
        <button className="primary" onClick={sendGift}>CREATE GIFT BOX FOR EVERYONE</button>
        {giftMsg && <p className="notice">{giftMsg}</p>}

        <h2>💰 Reward HD to one player</h2>
        <div className="formGrid">
          <label>PLAYER<select value={rewardTarget} onChange={e => setRewardTarget(e.target.value)}><option value="self">My own account</option>{players.map(p => <option key={p.id} value={p.id}>{p.username} ({p.role})</option>)}</select></label>
          <label>HD AMOUNT<input type="number" min="1" step="1" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} /></label>
        </div>
        <button className="primary" onClick={rewardHD}>REWARD HD</button>
        {rewardMsg && <p className="notice">{rewardMsg}</p>}

        <h2>Player management ({players.length})</h2>
        <div className="catalog">{players.map(player => <div className="catalogItem" key={player.id}>
          <div><b>{player.username}</b><small>{player.role.toUpperCase()}{player.is_banned ? " • BANNED" : ""}</small></div>
          {player.role !== "admin" && <div>
            {player.role === "tester" ? <button className="primary" onClick={() => changeRole(player.username, "player")}>MAKE PLAYER</button> : <button className="primary" onClick={() => changeRole(player.username, "tester")}>MAKE TESTER</button>}
            {player.is_banned ? <button className="primary" onClick={() => changeBan(player.username, false)}>UNBAN</button> : <button className="delete" onClick={() => { if (confirm(`Ban ${player.username} from collecting stickers?`)) void changeBan(player.username, true); }}>BAN</button>}
          </div>}
        </div>)}</div>
        <p className="notice">{msg}</p>
        <h2>Upload a sticker</h2>
        <div className="formGrid">
          <label>STICKER NAME<input value={name} onChange={e => setName(e.target.value)} placeholder="Golden Dragon" /></label>
          <label>RARITY<select value={rarity} onChange={e => setRarity(e.target.value)}><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option><option value="secret">Secret</option></select></label>
          <label className="fileLabel">IMAGE FILE<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        </div>
        <button className="primary" onClick={upload}>＋ UPLOAD STICKER</button>
        <h2 className="catalogTitle">Sticker catalog ({items.length})</h2>
        <div className="catalog">{items.map(s => <div className="catalogItem" key={s.id}><img src={s.image_url} alt={s.name} /><div><b>{s.name}</b><small className={s.rarity}>{s.rarity}</small></div><button className="delete" onClick={() => remove(s.id, s.storage_path)}>DELETE</button></div>)}</div>
      </>}
    </section>
  </main>;
}
