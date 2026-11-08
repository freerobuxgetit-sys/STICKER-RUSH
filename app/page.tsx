export default function MaintenancePage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "24px",
      background: "linear-gradient(135deg, #10051f, #241044, #080812)",
      color: "white",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ fontSize: "64px" }}>🔧</div>
      <h1 style={{ fontSize: "42px", margin: "12px 0" }}>STICKER RUSH</h1>
      <div style={{
        background: "#7137a8",
        padding: "8px 18px",
        borderRadius: "30px",
        fontWeight: "bold",
        letterSpacing: "2px"
      }}>MAINTENANCE MODE</div>
      <h2 style={{ fontSize: "28px", marginTop: "32px" }}>
        Something BIG is coming!
      </h2>
      <p style={{ maxWidth: "420px", lineHeight: 1.7, color: "#d8c9e8" }}>
        We're upgrading STICKER RUSH with a massive new update.
        The game is temporarily unavailable while we work behind the scenes.
      </p>
      <h2 style={{ color: "#c084fc" }}>MEGA UPDATE 2.0 🚀</h2>
      <p style={{ color: "#a99ab9", fontSize: "13px" }}>
        Thanks for your patience. See you soon!
      </p>
    </main>
  );
}
