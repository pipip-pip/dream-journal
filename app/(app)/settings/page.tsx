"use client";
// Settings are stored in the database, so they're the same on every device.
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase/client";
import { clearCache, getSettings, saveSettings } from "@/lib/data";
import { deleteAll, downloadJson, exportAll, importAll, type ImportSummary } from "@/lib/backup";
import { localDate } from "@/lib/sky";
import { DEFAULT_SETTINGS, LENGTHS, LENGTH_LABEL, MODES, MODE_LABEL, TONES, TONE_LABEL, type Settings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((x) => { setS(x); setLoaded(true); });
    supabase().auth.getUser().then(({ data }: any) => setEmail(data.user?.email ?? ""));
  }, []);

  // Save shortly after any change.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => saveSettings(s).then(() => setStatus("Saved")).catch(() => setStatus("Couldn't save")), 500);
    return () => clearTimeout(t);
  }, [s, loaded]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setStatus(""); };

  const doExport = async () => {
    setBusy(true);
    try { downloadJson(await exportAll(), `dream-journal-${localDate()}.json`); } finally { setBusy(false); }
  };

  const doImport = async (file: File) => {
    setBusy(true); setSummary(null); setStatus("");
    try {
      const data = JSON.parse(await file.text());
      setSummary(await importAll(data));
      getSettings().then(setS);
    } catch (e: any) {
      setStatus(e?.message?.includes("JSON") ? "That file isn't valid JSON." : e?.message || "Import failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doDelete = async () => {
    if (!confirm("Delete ALL your dreams, people, threads, fragments and settings? This can't be undone.")) return;
    if (prompt('Type DELETE to confirm') !== "DELETE") return;
    setBusy(true);
    try { await deleteAll(); setS(DEFAULT_SETTINGS); setStatus("Everything was deleted."); }
    catch { setStatus("Couldn't delete. Try again."); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    await supabase().auth.signOut();
    clearCache();
    window.location.href = "/login";
  };

  return (
    <>
      <div className="topbar"><h1>Settings</h1><span className="muted small">{status}</span></div>

      <div className="card">
        <span className="label">How literal are dreams?</span>
        <input type="range" min={0} max={100} step={5} value={s.literalness} onChange={(e) => set("literalness", Number(e.target.value))} />
        <div className="spread muted small"><span>Close to real life</span><span>Fully dreamlike</span></div>

        <span className="label" style={{ marginTop: 16 }}>Hard topics</span>
        <div className="row">
          <button className={`chip ${s.hard_topics === "reflect" ? "on" : ""}`} onClick={() => set("hard_topics", "reflect")}>Reflect gently</button>
          <button className={`chip ${s.hard_topics === "soften" ? "on" : ""}`} onClick={() => set("hard_topics", "soften")}>Soften heavily</button>
        </div>
      </div>

      <div className="card">
        <span className="label">Default tone</span>
        <div className="row">{TONES.map((t) => <button key={t} className={`chip ${s.default_tone === t ? "on" : ""}`} onClick={() => set("default_tone", t)}>{TONE_LABEL[t]}</button>)}</div>
        <span className="label" style={{ marginTop: 14 }}>Default length</span>
        <div className="row">{LENGTHS.map((l) => <button key={l} className={`chip ${s.default_length === l ? "on" : ""}`} onClick={() => set("default_length", l)}>{LENGTH_LABEL[l]}</button>)}</div>
        <span className="label" style={{ marginTop: 14 }}>Default mode (after noon)</span>
        <div className="row">{MODES.map((m) => <button key={m} className={`chip ${s.default_mode === m ? "on" : ""}`} onClick={() => set("default_mode", m)}>{MODE_LABEL[m]}</button>)}</div>
        <label className="spread" style={{ marginTop: 16, minHeight: 44 }}>
          <span>Show a waking thought</span>
          <input type="checkbox" checked={s.waking_thought} onChange={(e) => set("waking_thought", e.target.checked)} style={{ width: 22 }} />
        </label>
      </div>

      <div className="card">
        <span className="label">Daily dream limit</span>
        <p className="muted small" style={{ marginTop: 0 }}>Protects your API bill. Counts dreams in the last 24 hours.</p>
        <input type="number" inputMode="numeric" min={1} max={200} value={s.daily_limit}
          onChange={(e) => set("daily_limit", Math.max(1, Math.min(200, Number(e.target.value) || 1)))} style={{ width: 120 }} />
      </div>

      <div className="card">
        <span className="label">Appearance (this device)</span>
        <ThemeToggle />
      </div>

      <div className="card">
        <span className="label">Backup</span>
        <div className="row">
          <button onClick={doExport} disabled={busy}>⬇️ Export everything</button>
          <button onClick={() => fileRef.current?.click()} disabled={busy}>⬆️ Import a backup or old journal</button>
        </div>
        <p className="muted small">Import accepts this app's backups and exports from your old app (both the “Dream Journal” and “Lanternwood” formats). Dreams already here are skipped.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        {busy && <p className="muted small">Working…</p>}
        {summary && (
          <div className="banner fade-in">
            Imported {summary.entries} dream{summary.entries === 1 ? "" : "s"}, {summary.people} new people, {summary.threads} threads,{" "}
            {summary.fragments} fragments, {summary.rituals} rituals{summary.settings ? ", and your settings" : ""}.
            {summary.duplicates > 0 && <> Skipped {summary.duplicates} already here.</>}
            {summary.skipped > 0 && <> Skipped {summary.skipped} item{summary.skipped === 1 ? "" : "s"} it couldn't understand.</>}
          </div>
        )}
      </div>

      <div className="card">
        <span className="label">Account</span>
        <p className="muted small" style={{ marginTop: 0 }}>Signed in as {email}</p>
        <div className="row">
          <button onClick={signOut}>Sign out</button>
          <button className="ghost danger" onClick={doDelete} disabled={busy}>Delete all my data</button>
        </div>
      </div>
    </>
  );
}
