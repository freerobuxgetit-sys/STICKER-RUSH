"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Admin() {
  const [allowed,setAllowed] = useState(false);
  const [loading,setLoading] = useState(true);
  const [name,setName] = useState("");
  const [rarity,setRarity] = useState("rare");
  const [file,setFile] = useState<File|null>(null);
  const [items,setItems] = useState<any[]>([]);
  const [msg,setMsg] = useState("");
  async function load() {
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) { setMsg("Log in with your admin account first."); setLoading(false); return; }
    const {data} = await supabase.from("profiles").select("role").eq("id",user.id).single();
    if (data?.role === "admin") { setAllowed(true); const {data:stickers}=await supabase.from("stickers").select("*").order("created_at",{ascending:false}); setItems(stickers||[]); }
    else setMsg("Access denied. This account is not an admin.");
    setLoading(false);
  }
  useEffect(()=>{load()},[]);
  async function upload() {
    if (!file || !name.trim()) {setMsg("Add a sticker name and image.");return;}
    setMsg("Uploading…");
    const ext=file.name.split(".").pop()?.toLowerCase() || "png";
    const path=`${crypto.randomUUID()}.${ext}`;
    const {error:upErr}=await supabase.storage.from("stickers").upload(path,file,{upsert:false,contentType:file.type});
    if(upErr){setMsg(upErr.message);return;}
    const {data:{publicUrl}}=supabase.storage.from("stickers").getPublicUrl(path);
    const {error}=await supabase.from("stickers").insert({name:name.trim(),rarity,image_url:publicUrl,storage_path:path});
    if(error){setMsg(error.message);return;}
    setName("");setFile(null);setMsg("Sticker added successfully!");await load();
  }
  async function remove(id:string,path:string) {
    if(!confirm("Delete this sticker?")) return;
    await supabase.from("stickers").delete().eq("id",id);
    if(path) await supabase.storage.from("stickers").remove([path]);
    await load();
  }
  if(loading)return <main className="shell"><p>Checking admin access…</p></main>;
  return <main className="shell"><header className="top"><a className="brand" href="/">✦ STICKER RUSH</a><a className="ghost" href="/">← BACK TO GAME</a></header><section className="panel adminPanel"><div className="eyebrow">CONTROL ROOM</div><h1>Sticker <span>Admin</span></h1>{!allowed?<p className="notice">{msg}</p>:<>
    <h2>Upload a sticker</h2><div className="formGrid"><label>STICKER NAME<input value={name} onChange={e=>setName(e.target.value)} placeholder="Golden Dragon"/></label><label>RARITY<select value={rarity} onChange={e=>setRarity(e.target.value)}><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></label><label className="fileLabel">IMAGE FILE<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setFile(e.target.files?.[0]||null)}/></label></div><button className="primary" onClick={upload}>＋ UPLOAD STICKER</button><p className="notice">{msg}</p>
    <h2 className="catalogTitle">Sticker catalog ({items.length})</h2><div className="catalog">{items.map(s=><div className="catalogItem" key={s.id}><img src={s.image_url} alt={s.name}/><div><b>{s.name}</b><small className={s.rarity}>{s.rarity}</small></div><button className="delete" onClick={()=>remove(s.id,s.storage_path)}>DELETE</button></div>)}</div>
  </>}</section></main>;
}
