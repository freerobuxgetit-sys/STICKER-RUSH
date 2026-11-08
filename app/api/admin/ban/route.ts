import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;

    if (!url || !anonKey || !secretKey) {
      return NextResponse.json(
        { error: "Server Supabase configuration is missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: actor } = await admin
      .from("profiles")
      .select("role,is_banned")
      .eq("id", authData.user.id)
      .single();

    if (actor?.role !== "admin" || actor.is_banned) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const banned = body.banned;

    if (!username || typeof banned !== "boolean") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id,role")
      .eq("username", username)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    if (target.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be banned or changed here." },
        { status: 403 }
      );
    }

    if (banned) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({ is_banned: true })
        .eq("id", target.id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      const { error: authBanError } = await admin.auth.admin.updateUserById(
        target.id,
        { ban_duration: "876000h" }
      );

      if (authBanError) {
        await admin.from("profiles").update({ is_banned: false }).eq("id", target.id);
        return NextResponse.json({ error: authBanError.message }, { status: 500 });
      }
    } else {
      const { error: authUnbanError } = await admin.auth.admin.updateUserById(
        target.id,
        { ban_duration: "none" }
      );

      if (authUnbanError) {
        return NextResponse.json({ error: authUnbanError.message }, { status: 500 });
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({ is_banned: false })
        .eq("id", target.id);

      if (profileError) {
        await admin.auth.admin.updateUserById(target.id, {
          ban_duration: "876000h",
        });
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: banned ? "Player banned." : "Player unbanned.",
    });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
