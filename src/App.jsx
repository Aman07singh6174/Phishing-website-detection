import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, BadgeCheck,
  BarChart3, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Copy,
  ExternalLink, Fingerprint, Globe2, History, Info, LayoutDashboard, Link2,
  LockKeyhole, Menu, Radar, Search, Shield, ShieldAlert, ShieldCheck,
  ShieldQuestion, Sparkles, Target, X, Zap
} from "lucide-react";

const navigation = [
  { id: "home", label: "Overview", icon: Shield },
  { id: "scanner", label: "URL scanner", icon: Radar },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "history", label: "Scan history", icon: History },
  { id: "about", label: "About PhishGuard", icon: CircleHelp }
];
const riskOrder = ["Low", "Medium", "High", "Critical"];

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function riskClass(level = "Low") {
  return level.toLowerCase();
}

function RiskPill({ level }) {
  const Icon = level === "Low" ? ShieldCheck : level === "Medium" ? ShieldQuestion : ShieldAlert;
  return <span className={`risk-pill risk-${riskClass(level)}`}><Icon size={14} />{level} risk</span>;
}

function App() {
  const [page, setPage] = useState("home");
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [scans, setScans] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyRisk, setHistoryRisk] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Dashboard statistics are unavailable.");
      }
      setStats(await response.json());
      setStatsError("");
    } catch (caught) {
      setStats(null);
      setStatsError(caught.message || "Dashboard statistics are unavailable.");
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    const query = new URLSearchParams({ search: historySearch, risk: historyRisk, limit: "100" });
    try {
      const response = await fetch(`/api/scans?${query}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Scan history is unavailable.");
      }
      setScans(await response.json());
      setHistoryError("");
    } catch (caught) {
      setScans([]);
      setHistoryError(caught.message || "Scan history is unavailable.");
    }
  }, [historyRisk, historySearch]);

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then((response) => response.json()).catch(() => null),
      refreshStats()
    ]).then(([status]) => setHealth(status));
  }, [refreshStats]);

  useEffect(() => {
    if (page === "history") refreshHistory();
  }, [page, refreshHistory]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!scanning) return undefined;
    const timer = window.setInterval(() => setProgress((current) => Math.min(current + 3, 92)), 110);
    return () => window.clearInterval(timer);
  }, [scanning]);

  const submitScan = async (event) => {
    event?.preventDefault();
    setError("");
    setNotice("");
    setScan(null);
    if (!url.trim()) {
      setError("Enter a website URL to get started.");
      return;
    }
    setScanning(true);
    setProgress(6);
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The scan could not be completed.");
      setProgress(100);
      setScan(result);
      refreshStats();
      if (page === "history") refreshHistory();
    } catch (caught) {
      setError(caught.message || "Unable to connect to the scan service.");
    } finally {
      setScanning(false);
      setProgress(0);
    }
  };

  const navigate = (nextPage) => {
    setPage(nextPage);
    setMobileMenu(false);
    setError("");
  };

  const testSample = (sample) => {
    setUrl(sample);
    setPage("scanner");
    setScan(null);
    setError("");
  };

  const copyResult = async () => {
    if (!scan) return;
    const text = [
      "PhishGuard URL scan report",
      `URL: ${scan.url}`,
      `Risk: ${scan.riskLevel} (${scan.riskScore}/100)`,
      `HTTPS declared: ${scan.https ? "Yes" : "No"}`,
      `Scanned: ${formatDate(scan.createdAt)}`,
      `Indicators: ${scan.indicators.length ? scan.indicators.map((item) => item.title).join(", ") : "No major URL-based indicators"}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Scan summary copied to clipboard.");
    } catch {
      setNotice("Clipboard access was denied by your browser.");
    }
  };

  const downloadReport = async () => {
    if (!scan) return;
    let jsPDF;
    try {
      ({ jsPDF } = await import("jspdf"));
    } catch (caught) {
      setNotice(`PDF report could not be generated: ${caught.message || "PDF library unavailable."}`);
      return;
    }
    const pdf = new jsPDF();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("PhishGuard scan report", 18, 22);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Generated ${formatDate(scan.createdAt)}`, 18, 30);
    pdf.setFontSize(12);
    pdf.text("Scanned URL", 18, 44);
    pdf.setFontSize(10);
    pdf.splitTextToSize(scan.url, 174).forEach((line, index) => pdf.text(line, 18, 51 + index * 5));
    let y = 69;
    pdf.setFontSize(12);
    pdf.text(`Risk assessment: ${scan.riskLevel} (${scan.riskScore}/100)`, 18, y);
    y += 8;
    pdf.setFontSize(10);
    pdf.text(`HTTPS scheme: ${scan.https ? "Yes (certificate not verified)" : "No"}`, 18, y);
    y += 10;
    pdf.setFontSize(12);
    pdf.text("URL indicators", 18, y);
    y += 7;
    pdf.setFontSize(9);
    const indicatorLines = scan.indicators.length
      ? scan.indicators.flatMap((item) => pdf.splitTextToSize(`- ${item.title}: ${item.detail}`, 174))
      : ["No major URL-based warning signs were detected."];
    for (const line of indicatorLines) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 18, y);
      y += 5;
    }
    y += 7;
    pdf.setFontSize(12);
    pdf.text("Recommendations", 18, y);
    y += 7;
    pdf.setFontSize(9);
    for (const recommendation of scan.recommendations) {
      const lines = pdf.splitTextToSize(`- ${recommendation}`, 174);
      if (y + lines.length * 5 > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(lines, 18, y);
      y += lines.length * 5 + 2;
    }
    pdf.setFontSize(8);
    pdf.text("URL analysis cannot verify website content, certificate validity, or guarantee safety.", 18, 285);
    pdf.save("phishguard-scan-report.pdf");
  };

  const currentPage = navigation.find((item) => item.id === page);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => navigate("home")} aria-label="PhishGuard home">
          <span className="brand-mark"><Shield size={22} strokeWidth={2.2} /><i /></span>
          <span className="brand-copy">phish<span>guard</span><small>THREAT INTELLIGENCE</small></span>
        </button>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? "nav-active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id === "scanner" && <span className="nav-shortcut">↵</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon"><LockKeyhole size={16} /></span>
            <div><strong>Privacy first</strong><p>We never visit the URL you submit.</p></div>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">PG</span>
            <div><strong>Local workspace</strong><span>Personal scanner</span></div>
            <span className={`health-dot ${health?.database === "connected" ? "online" : ""}`} title={health?.database === "connected" ? "Database connected" : "Database unavailable"} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Toggle navigation">
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{currentPage?.label}</strong></div>
          <div className="topbar-right">
            <span className="live-status"><i /> SYSTEM {health?.database === "connected" ? "OPERATIONAL" : "OFFLINE"}</span>
            <span className="topbar-divider" />
            <span className="topbar-date">{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </header>

        <div className="page-content">
          {page === "home" && <HomePage navigate={navigate} url={url} setUrl={setUrl} submitScan={submitScan} scanning={scanning} progress={progress} scan={scan} error={error} testSample={testSample} downloadReport={downloadReport} copyResult={copyResult} health={health} />}
          {page === "scanner" && <ScannerPage url={url} setUrl={setUrl} submitScan={submitScan} scanning={scanning} progress={progress} scan={scan} error={error} testSample={testSample} downloadReport={downloadReport} copyResult={copyResult} health={health} />}
          {page === "dashboard" && <DashboardPage stats={stats} error={statsError} navigate={navigate} />}
          {page === "history" && <HistoryPage scans={scans} error={historyError} search={historySearch} setSearch={setHistorySearch} risk={historyRisk} setRisk={setHistoryRisk} setScan={setScan} navigate={navigate} />}
          {page === "about" && <AboutPage />}
        </div>
        <footer className="footer"><span>© {new Date().getFullYear()} PhishGuard Security</span><span><LockKeyhole size={13} /> No scanned website is opened or fetched</span><span>Built for a safer web</span></footer>
      </main>
      {notice && <div className="toast" role="status"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function HomePage(props) {
  const { navigate, ...scannerProps } = props;
  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span /> INTELLIGENCE FOR A SAFER WEB</div>
          <h1>Trust the link.<br /><span>Not the disguise.</span></h1>
          <p>Get a clearer picture before you click. PhishGuard analyzes suspicious URLs for common phishing signals—without ever opening the website.</p>
          <div className="hero-actions"><button className="button button-primary" onClick={() => navigate("scanner")}>Analyze a URL <ArrowRight size={17} /></button><button className="button button-quiet" onClick={() => navigate("about")}>How it works <ArrowDownRight size={16} /></button></div>
          <div className="hero-proof"><span><Check size={14} /> Rule-based analysis</span><span><Check size={14} /> Private by design</span><span><Check size={14} /> No site visits</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="shield-glow"><div className="shield-inner"><ShieldCheck size={59} strokeWidth={1.4} /></div></div>
          <span className="orbit-dot dot-a"><LockKeyhole size={15} /></span><span className="orbit-dot dot-b"><Fingerprint size={16} /></span><span className="orbit-dot dot-c"><Zap size={15} /></span>
          <div className="signal-card"><span className="signal-wave"><Activity size={15} /></span><span><strong>Threat analysis</strong><small>Always on your side</small></span><i /></div>
          <div className="art-grid" />
        </div>
      </section>

      <ScannerPanel {...scannerProps} compact />

      <section className="feature-strip">
        <div className="feature-item"><span className="feature-icon blue"><Target size={19} /></span><div><strong>Explainable signals</strong><p>See exactly what raised a flag.</p></div></div>
        <div className="feature-item"><span className="feature-icon violet"><Globe2 size={19} /></span><div><strong>Threat intelligence</strong><p>Optional Google Safe Browsing.</p></div></div>
        <div className="feature-item"><span className="feature-icon green"><LockKeyhole size={19} /></span><div><strong>Safer by design</strong><p>No scanning by visiting the site.</p></div></div>
      </section>

      <section className="demo-section">
        <div><div className="eyebrow"><span /> TRY A DEMO</div><h2>Explore with sample URLs</h2><p>These are clearly labeled demonstration addresses. Scans are based on URL patterns, not website visits.</p></div>
        <div className="demo-cards">
          <button className="demo-card" onClick={() => props.testSample("https://example.com")}><span className="demo-icon demo-safe"><ShieldCheck size={17} /></span><span><strong>Low-signal example</strong><small>https://example.com</small></span><ArrowRight size={16} /></button>
          <button className="demo-card" onClick={() => props.testSample("http://verify-login.example.xyz/account")}><span className="demo-icon demo-warn"><AlertTriangle size={17} /></span><span><strong>Suspicious-pattern example</strong><small>http://verify-login.example.xyz/…</small></span><ArrowRight size={16} /></button>
        </div>
      </section>
    </>
  );
}

function ScannerPage(props) {
  return (
    <>
      <PageHeading eyebrow="URL THREAT ANALYSIS" title="Website scanner" description="Analyze a link before you open it. We inspect the URL only—your browser will not visit the destination." />
      <ScannerPanel {...props} />
      <div className="scanner-assurance"><LockKeyhole size={16} /><span><strong>Safe scanning by design</strong> — submitted URLs are never fetched, resolved, or opened by this server.</span><Info size={15} /></div>
    </>
  );
}

function ScannerPanel({ url, setUrl, submitScan, scanning, progress, scan, error, testSample, downloadReport, copyResult, compact, health }) {
  return (
    <section className={`scanner-card ${compact ? "scanner-compact" : ""}`}>
      <div className="scanner-card-head"><div className="scanner-heading-icon"><Radar size={19} /></div><div><h2>{compact ? "Check a suspicious link" : "Start a new analysis"}</h2><p>Paste a URL to reveal potential phishing indicators.</p></div><div className="scanner-tag"><i /> RULE ENGINE</div></div>
      <form className="url-form" onSubmit={submitScan}>
        <label className="url-input-wrap"><Link2 size={18} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" aria-label="Website URL to scan" autoComplete="url" maxLength={2048} /><span className="input-protocol">URL</span></label>
        <button className="button button-primary scan-button" type="submit" disabled={scanning}><span>{scanning ? "Analyzing" : "Scan website"}</span>{scanning ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
      </form>
      <div className="input-footnote"><span><LockKeyhole size={13} /> Never enter passwords or private links.</span><span>Up to 2,048 characters</span></div>
      {error && <div className="inline-error" role="alert"><AlertTriangle size={16} />{error}</div>}
      {scanning && <div className="scan-progress" role="status"><div className="progress-caption"><span><span className="spinner small" /> Checking URL structure and risk signals</span><span>{progress}%</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="progress-steps"><span className={progress > 15 ? "step-done" : ""}>URL validation</span><span className={progress > 45 ? "step-done" : ""}>Signal analysis</span><span className={progress > 75 ? "step-done" : ""}>Reputation check</span></div></div>}
      {!scanning && !scan && !compact && <div className="sample-inline"><span>Try a demo:</span><button type="button" onClick={() => testSample("https://example.com")}>Low-signal URL</button><button type="button" onClick={() => testSample("http://verify-login.example.xyz/account")}>Suspicious-pattern URL</button></div>}
      {health?.database !== "connected" && !scanning && !scan && <div className="backend-warning"><Info size={15} /> API or database unavailable. Check the server and MySQL connection to save scans and view history.</div>}
      {scan && <ScanResult scan={scan} downloadReport={downloadReport} copyResult={copyResult} />}
    </section>
  );
}

function ScanResult({ scan, downloadReport, copyResult }) {
  const ringStyle = { "--score": `${scan.riskScore * 3.6}deg` };
  const safeBrowsingStatus = scan.reputation.status;
  return (
    <div className="result-wrap">
      <div className="result-divider" />
      <div className="result-topline"><div><div className="eyebrow"><span /> ANALYSIS COMPLETE</div><h2>Scan results</h2></div><div className="result-actions"><button className="button button-outline" onClick={copyResult}><Copy size={15} /> Copy summary</button><button className="button button-outline" onClick={downloadReport}><ExternalLink size={15} /> Download PDF</button></div></div>
      <div className="result-overview">
        <div className="score-card">
          <div className={`score-ring ring-${riskClass(scan.riskLevel)}`} style={ringStyle}><div><strong>{scan.riskScore}</strong><span>/100</span></div></div>
          <div><RiskPill level={scan.riskLevel} /><p className="score-caption">{scan.riskLevel === "Low" ? "No major URL-based warning signs" : "Potentially risky URL patterns identified"}</p></div>
        </div>
        <div className="result-url"><span>SCANNED ADDRESS</span><code>{scan.url}</code><div className="result-url-meta"><span><Globe2 size={14} /> {scan.hostname}</span><span>{scan.https ? <><LockKeyhole size={13} /> HTTPS scheme</> : <><AlertTriangle size={13} /> HTTP only</>}</span></div></div>
      </div>
      <div className="result-grid">
        <div className="result-section indicators-section"><div className="section-title"><span className="section-title-icon"><Activity size={16} /></span><div><h3>Signals detected</h3><span>{scan.indicators.length} URL-based indicator{scan.indicators.length === 1 ? "" : "s"}</span></div></div>
          {scan.indicators.length ? <div className="indicator-list">{scan.indicators.map((item) => <div className={`indicator-row ${item.severity}`} key={item.id}><span className="indicator-marker">{item.severity === "danger" ? <AlertTriangle size={15} /> : <Info size={15} />}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className="indicator-points">+{item.points}</span></div>)}</div> : <div className="empty-signals"><BadgeCheck size={22} /><span><strong>No major URL signals found</strong><small>This is not proof the website is safe.</small></span></div>}
          <div className="reputation-row"><span><Globe2 size={15} /> Google Safe Browsing</span><span className={`reputation-state ${safeBrowsingStatus}`}>{safeBrowsingStatus === "match" ? "THREAT MATCH" : safeBrowsingStatus === "no_match" ? "NO KNOWN MATCH" : safeBrowsingStatus === "error" ? "CHECK FAILED" : "NOT CONFIGURED"}</span></div>
          {safeBrowsingStatus === "error" && <p className="reputation-note">{scan.reputation.message}</p>}
          {safeBrowsingStatus === "no_match" && <p className="reputation-note">No match found in this provider’s database. This does not guarantee safety.</p>}
        </div>
        <div className="result-section recommendations-section"><div className="section-title"><span className="section-title-icon recommend-icon"><ShieldCheck size={16} /></span><div><h3>What you can do</h3><span>Recommended next steps</span></div></div><ul className="recommendation-list">{scan.recommendations.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ul><div className="result-disclaimer"><Info size={14} /><span>URL-only analysis cannot inspect page content, verify certificates, or guarantee that a site is safe.</span></div></div>
      </div>
    </div>
  );
}

function DashboardPage({ stats, error, navigate }) {
  if (!stats) return <><PageHeading eyebrow="SECURITY OVERVIEW" title="Your dashboard" description="A clear overview of your URL analysis activity." /><div className="empty-state"><BarChart3 size={28} /><h3>Dashboard unavailable</h3><p>{error || "Dashboard statistics are unavailable."}</p></div></>;
  const total = stats.total || 1;
  const metrics = [
    { label: "Total scans", value: stats.total, icon: Radar, tone: "blue", detail: "All analyzed URLs" },
    { label: "Low risk", value: stats.low, icon: ShieldCheck, tone: "green", detail: `${Math.round(stats.low / total * 100)}% of scans` },
    { label: "Suspicious", value: stats.medium + stats.high, icon: ShieldQuestion, tone: "amber", detail: "Medium and high risk" },
    { label: "Critical", value: stats.critical, icon: ShieldAlert, tone: "red", detail: "Requires extra caution" }
  ];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toLocaleDateString("en-CA");
    return stats.trend.find((item) => new Date(item.day).toLocaleDateString("en-CA") === key) || { day: key, total: 0, flagged: 0 };
  });
  const maxCount = Math.max(1, ...days.map((day) => day.total));
  return (
    <>
      <PageHeading eyebrow="SECURITY OVERVIEW" title="Your dashboard" description="A clear overview of your URL analysis activity." action={<button className="button button-primary" onClick={() => navigate("scanner")}>New scan <ArrowRight size={16} /></button>} />
      <div className="metric-grid">{metrics.map(({ label, value, icon: Icon, tone, detail }) => <div className="metric-card" key={label}><div className={`metric-icon ${tone}`}><Icon size={18} /></div><span className="metric-label">{label}</span><strong>{value.toLocaleString()}</strong><span className="metric-detail">{detail}</span></div>)}</div>
      <div className="dashboard-grid">
        <section className="panel trend-panel"><div className="panel-heading"><div><h2>Scan activity</h2><p>Your last 7 days</p></div><span className="chart-legend"><i /> All scans <i className="legend-flagged" /> High risk</span></div>
          {stats.total === 0 ? <div className="chart-empty"><Activity size={22} /><span>Activity will appear here after your first scan.</span></div> : <div className="bar-chart">{days.map((day) => { const height = day.total ? Math.max(12, day.total / maxCount * 100) : 3; const flagged = day.total ? day.flagged / day.total * 100 : 0; return <div className="chart-column" key={String(day.day)}><div className="bar-slot"><span className="bar" style={{ height: `${height}%` }}><i style={{ height: `${flagged}%` }} /></span><span className="bar-count">{day.total || ""}</span></div><span className="chart-day">{new Date(day.day).toLocaleDateString(undefined, { weekday: "short" })}</span></div>; })}</div>}
        </section>
        <section className="panel risk-panel"><div className="panel-heading"><div><h2>Risk distribution</h2><p>Across all recorded scans</p></div></div><div className="risk-distribution"><div className={`donut ${stats.total ? "" : "donut-empty"}`} style={stats.total ? { "--low": `${stats.low / total * 100}%`, "--medium": `${stats.medium / total * 100}%`, "--high": `${stats.high / total * 100}%` } : undefined}><div><strong>{stats.total}</strong><span>scans</span></div></div><div className="risk-legend">{riskOrder.map((level) => <div key={level}><i className={`legend-${riskClass(level)}`} /><span>{level}</span><strong>{stats[riskClass(level)]}</strong></div>)}</div></div></section>
      </div>
      <div className="dashboard-tip"><span><Sparkles size={17} /></span><p><strong>A note on risk scores</strong> Scores reflect URL patterns and available threat intelligence—not a guarantee that a site is safe or harmful.</p><button onClick={() => navigate("about")}>Detection methodology <ArrowRight size={15} /></button></div>
    </>
  );
}

function HistoryPage({ scans, error, search, setSearch, risk, setRisk, setScan, navigate }) {
  const openScan = (item) => {
    setScan(item);
    navigate("scanner");
  };
  return (
    <>
      <PageHeading eyebrow="YOUR ACTIVITY" title="Scan history" description="Search and review previously analyzed URLs." action={<button className="button button-primary" onClick={() => navigate("scanner")}>New scan <ArrowRight size={16} /></button>} />
      <section className="panel history-panel">
        <div className="history-toolbar"><label className="history-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search URLs or domains…" /></label><label className="filter-select"><span>{risk || "All risk levels"}</span><ChevronDown size={15} /><select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Filter by risk level"><option value="">All risk levels</option>{riskOrder.map((level) => <option key={level}>{level}</option>)}</select></label><span className="history-count">{scans.length} result{scans.length === 1 ? "" : "s"}</span></div>
        {!error && scans.length ? <div className="table-scroll"><table className="history-table"><thead><tr><th>SCANNED URL</th><th>RISK ASSESSMENT</th><th>HTTPS</th><th>DATE SCANNED</th><th /></tr></thead><tbody>{scans.map((item) => <tr key={item.id}><td><button className="history-url" onClick={() => openScan(item)}><strong>{item.hostname}</strong><span>{item.url}</span></button></td><td><div className="table-risk"><RiskPill level={item.riskLevel} /><span>{item.riskScore}/100</span></div></td><td><span className={`https-status ${item.https ? "https-yes" : "https-no"}`}>{item.https ? <><LockKeyhole size={13} /> Yes</> : <><X size={13} /> No</>}</span></td><td className="history-date"><Clock3 size={13} />{formatDate(item.createdAt)}</td><td><button className="icon-button row-open" onClick={() => openScan(item)} aria-label={`View scan of ${item.hostname}`}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state history-empty"><History size={27} /><h3>{error ? "History unavailable" : "No scans found"}</h3><p>{error || (search || risk ? "Try adjusting your search or filter." : "Your completed URL scans will appear here.")}</p>{!error && !search && !risk && <button className="button button-primary" onClick={() => navigate("scanner")}>Scan your first URL <ArrowRight size={15} /></button>}</div>}
      </section>
    </>
  );
}

function AboutPage() {
  const steps = [
    { number: "01", icon: Link2, title: "Inspect URL structure", description: "We parse the submitted address and review its hostname, URL length, scheme, subdomains, and other visible patterns. We never request the destination." },
    { number: "02", icon: Fingerprint, title: "Compare risk signals", description: "A transparent rule-based engine assigns weighted points for indicators such as IP-based hosts, URL shorteners, suspicious terms, and unusual extensions." },
    { number: "03", icon: Globe2, title: "Check reputation (optional)", description: "If an administrator configures a Google Safe Browsing API key, the submitted URL is checked against that service. The key stays on the server." },
    { number: "04", icon: BarChart3, title: "Explain the result", description: "You receive a risk score, the signals behind it, and practical next steps. Historical reports are stored in the configured MySQL database." }
  ];
  return (
    <>
      <PageHeading eyebrow="ABOUT THE PROJECT" title="A smarter pause before the click." description="PhishGuard is a transparent URL screening tool built to help people spot warning signs—not replace good security judgment." />
      <section className="about-hero"><div className="about-hero-icon"><Shield size={28} /></div><div><div className="eyebrow"><span /> BUILT FOR EVERYDAY DEFENSE</div><h2>Phishing works by making a fake feel familiar.</h2><p>Attackers often disguise links to look like a bank, workplace, delivery service, or account page. A quick check of the address can reveal clues—but attackers constantly adapt, and no URL-only tool can promise safety.</p></div></section>
      <div className="method-heading"><div><div className="eyebrow"><span /> TRANSPARENT BY DESIGN</div><h2>How our analysis works</h2></div><span>01 — 04</span></div>
      <section className="method-grid">{steps.map(({ number, icon: Icon, title, description }) => <article className="method-card" key={number}><div className="method-card-top"><span>{number}</span><Icon size={19} /></div><h3>{title}</h3><p>{description}</p></article>)}</section>
      <div className="limitations-panel"><span><Info size={17} /></span><div><strong>Important limitations</strong><p>A low score is not a safety certification. PhishGuard does not visit the site, inspect its page or redirects, validate TLS certificates, check domain age, or guarantee that a URL is harmless. Avoid submitting URLs containing private tokens or personal information.</p></div></div>
      <section className="about-bottom"><div><LockKeyhole size={16} /><span><strong>Never enter passwords</strong> into a URL checker.</span></div><div><ShieldCheck size={16} /><span><strong>Verify independently</strong> before sharing sensitive information.</span></div></section>
    </>
  );
}

export default App;
