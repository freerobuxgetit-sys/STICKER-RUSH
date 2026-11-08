"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  username: string;
  role: string;
  is_banned: boolean;
};

export default function Admin() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rarity, setRarity] = useState("rare");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMsg("Log in with your admin account first.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      setMsg("Access denied. This account is not an admin.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const { data: stickers, error: stickerError } = await supabase
      .from("stickers")
      .select("*")
      .order("created_at", { ascending: false });

    if (stickerError) setMsg(stickerError.message);
    else setItems(stickers || []);

    const { data: playerData, error: playerError } =
      await supabase.rpc("admin_list_players");

    if (playerError) setMsg(playerError.message);
    else setPlayers(playerData || []);

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function changeRole(username: string, role: string) {
    const { error } = await supabase.rpc("admin_set_role", {
      target_username: username,
      new_role: role,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(`${username} is now ${role}.`);
    await load();
  }

  async function changeBan(username: string, banned: boolean) {
    const { data: { session }, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !session) {
      setMsg("Please log in again.");
      return;
    }

    const response = await fetch("/api/admin/ban", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ username, banned }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMsg(result.error || "Ban operation failed.");
      return;
    }

    setMsg(
      banned
        ? `${username} has been banned.`
        : `${username} has been unbanned.`
    );

    await load();
  }

  async function upload() {
    if (!file || !name.trim()) {
      setMsg("Add a sticker name and image.");
      return;
    }

    setMsg("Uploading…");

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("stickers")
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (upErr) {
      setMsg(upErr.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("stickers")
      .getPublicUrl(path);

    const { error } = await supabase.from("stickers").insert({
      name: name.trim(),
      rarity,
      image_url: publicUrl,
      storage_path: path,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setName("");
    setFile(null);
    setMsg("Sticker added successfully!");
    await load();
  }

  async function remove(id: string, path: string) {
    if (!confirm("Delete this sticker?")) return;

    const { error } = await supabase
      .from("stickers")
      .delete()
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    if (path) {
      const { error: storageError } = await supabase.storage
        .from("stickers")
        .remove([path]);

      if (storageError) {
        setMsg(`Sticker deleted, but image cleanup failed: ${storageError.message}`);
        await load();
        return;
      }
    }

    setMsg("Sticker deleted.");
    await load();
  }

  if (loading) {
    return (
      <main className="shell">
        <p>Checking admin access…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="top">
        <a className="brand" href="/">✦ STICKER RUSH</a>
        <a className="ghost" href="/">← BACK TO GAME</a>
      </header>

      <section className="panel adminPanel">
        <div className="eyebrow">CONTROL ROOM</div>
        <h1>Sticker <span>Admin</span></h1>

        {!allowed ? (
          <p className="notice">{msg}</p>
        ) : (
          <>
            <h2>Player management ({players.length})</h2>

            <div className="catalog">
              {players.map((player) => (
                <div className="catalogItem" key={player.id}>
                  <div>
                    <b>{player.username}</b>
                    <small>
                      {player.role.toUpperCase()}
                      {player.is_banned ? " • BANNED" : ""}
                    </small>
                  </div>

                  {player.role !== "admin" && (
                    <div>
                      {player.role === "tester" ? (
                        <button
                          className="primary"
                          onClick={() => changeRole(player.username, "player")}
                        >
                          MAKE PLAYER
                        </button>
                      ) : (
                        <button
                          className="primary"
                          onClick={() => changeRole(player.username, "tester")}
                        >
                          MAKE TESTER
                        </button>
                      )}

                      {player.is_banned ? (
                        <button
                          className="primary"
                          onClick={() => changeBan(player.username, false)}
                        >
                          UNBAN
                        </button>
                      ) : (
                        <button
                          className="delete"
                          onClick={() => {
                            if (confirm(`Ban ${player.username} from collecting stickers?`)) {
                              void changeBan(player.username, true);
                            }
                          }}
                        >
                          BAN
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="notice">{msg}</p>

            <h2>Upload a sticker</h2>

            <div className="formGrid">
              <label>
                STICKER NAME
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Golden Dragon"
                />
              </label>

              <label>
                RARITY
                <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </label>

              <label className="fileLabel">
                IMAGE FILE
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <button className="primary" onClick={upload}>
              ＋ UPLOAD STICKER
            </button>

            <h2 className="catalogTitle">Sticker catalog ({items.length})</h2>

            <div className="catalog">
              {items.map((s) => (
                <div className="catalogItem" key={s.id}>
                  <img src={s.image_url} alt={s.name} />
                  <div>
                    <b>{s.name}</b>
                    <small className={s.rarity}>{s.rarity}</small>
                  </div>
                  <button
                    className="delete"
                    onClick={() => remove(s.id, s.storage_path)}
                  >
                    DELETE
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
