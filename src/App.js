import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import * as api from "./api";

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const CATS = {
  Application: ["New Internal App", "Mobile Scanning App"],
  WMS: [
    "In-house WMS",
    "WMS Enhancement",
    "WMS Integration",
    "API Integration",
  ],
  Automation: [
    "JavaScript Automation",
    "Node Automation",
    "Process Automation",
  ],
  Dashboard: [
    "Live Dashboard",
    "KPI Dashboard",
    "Productivity Dashboard",
    "Operational Dashboard",
  ],
  Report: [
    "Operational Report",
    "Exception Report",
    "KPI Report",
    "Management Report",
  ],
};
const DEPTS = [
  "Warehouse Ops",
  "IT / Systems",
  "Inventory",
  "Transport",
  "Procurement",
  "Finance",
  "HR",
];
const COUNTRIES = [
  "Malaysia",
  "Singapore",
  "Thailand",
  "Indonesia",
  "Vietnam",
  "Philippines",
  "Global",
];
const WAREHOUSES = [
  "WH-MY-01",
  "WH-SG-01",
  "WH-SG-02",
  "WH-TH-01",
  "WH-ID-01",
  "WH-VN-01",
  "All",
];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const RISKS = ["Critical", "High", "Medium", "Low"];
const ROLES = [
  "Requestor",
  "Department Manager",
  "Operation Head",
  "IT Team",
  "HOD",
  "VP",
  "Admin",
];
const STATUSES = [
  "Draft",
  "Submitted",
  "Pending Manager",
  "Pending Operation Head",
  "Pending IT Review",
  "Pending HOD",
  "Pending VP",
  "Approved",
  "Rejected",
  "Revision Required",
  "In Development",
  "SIT Testing",
  "UAT Testing",
  "Pending Go Live",
  "Go Live",
  "Monitoring",
  "Closed",
];

const CAT_C = {
  Application: "#0EA5E9",
  WMS: "#8B5CF6",
  Automation: "#F59E0B",
  Dashboard: "#10B981",
  Report: "#EC4899",
};
const CAT_I = {
  Application: "💻",
  WMS: "🏭",
  Automation: "⚙️",
  Dashboard: "📊",
  Report: "📋",
};
const PRI_C = {
  Critical: "#EF4444",
  High: "#F97316",
  Medium: "#EAB308",
  Low: "#22C55E",
};
const STA_C = {
  "Pending Manager": "#FBBF24",
  "Pending Operation Head": "#FB923C",
  "Pending IT Review": "#A78BFA",
  "Pending HOD": "#F472B6",
  "Pending VP": "#EC4899",
  Approved: "#34D399",
  Rejected: "#F87171",
  "In Development": "#38BDF8",
  "SIT Testing": "#818CF8",
  "UAT Testing": "#C084FC",
  "Go Live": "#4ADE80",
  Monitoring: "#2DD4BF",
  Closed: "#6B7280",
  Draft: "#94A3B8",
  Submitted: "#60A5FA",
  "Revision Required": "#FCD34D",
  "Pending Go Live": "#FB7185",
};
const ROL_C = {
  Requestor: "#60A5FA",
  "Department Manager": "#FBBF24",
  "Operation Head": "#FB923C",
  "IT Team": "#A78BFA",
  HOD: "#F472B6",
  VP: "#EC4899",
  Admin: "#34D399",
};

const NEXT_STATUS = {
  "Pending Manager": {
    normal: "Pending Operation Head",
    vp: "Pending Operation Head",
    level: 1,
  },
  "Pending Operation Head": {
    normal: "Pending IT Review",
    vp: "Pending IT Review",
    level: 2,
  },
  "Pending IT Review": { normal: "Pending HOD", vp: "Pending HOD", level: 3 },
  "Pending HOD": { normal: "Approved", vp: "Pending VP", level: 4 },
  "Pending VP": { normal: "Approved", vp: "Approved", level: 5 },
};

function needsVP(r) {
  return (
    [
      "In-house WMS",
      "WMS Enhancement",
      "WMS Integration",
      "API Integration",
    ].includes(r.subCategory || r.sub_category) ||
    r.country === "Global" ||
    (r.estimatedDays || r.estimated_days || 0) > 14 ||
    r.downtimeRisk ||
    r.downtime_risk ||
    r.riskLevel === "Critical" ||
    r.risk_level === "Critical"
  );
}

// ── UI ATOMS ───────────────────────────────────────────────────────────────────
const INP = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  background: "#0F172A",
  border: "1px solid #334155",
  color: "#E2E8F0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const Tag = ({ label, color }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 9px",
      borderRadius: 20,
      background: color + "22",
      color,
      fontSize: 10,
      fontWeight: 700,
      border: "1px solid " + color + "44",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);
const Sta = ({ s }) => <Tag label={s} color={STA_C[s] || "#94A3B8"} />;

function Btn({
  onClick,
  children,
  color = "#0EA5E9",
  outline,
  sm,
  full,
  disabled,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: sm ? "5px 12px" : "9px 18px",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        fontSize: sm ? 11 : 13,
        border: "1.5px solid " + color,
        background: outline ? "transparent" : disabled ? color + "44" : color,
        color: outline ? color : "#fff",
        fontFamily: "inherit",
        width: full ? "100%" : "auto",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000088",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#1E293B",
          borderRadius: 16,
          border: "1px solid #334155",
          width: "100%",
          maxWidth: wide ? 960 : 540,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid #334155",
            position: "sticky",
            top: 0,
            background: "#1E293B",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E2E8F0" }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

const Lbl = ({ children }) => (
  <label
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: "#64748B",
      display: "block",
      marginBottom: 4,
    }}
  >
    {children}
  </label>
);
const Fld = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <Lbl>{label}</Lbl>
    {children}
  </div>
);
const SI = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <Fld label={label}>
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) =>
        onChange(type === "number" ? +e.target.value : e.target.value)
      }
      placeholder={placeholder}
      style={INP}
    />
  </Fld>
);
const SS = ({ label, value, onChange, options }) => (
  <Fld label={label}>
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={INP}
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  </Fld>
);
const ST = ({ label, value, onChange, rows = 3 }) => (
  <Fld label={label}>
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{ ...INP, resize: "vertical" }}
    />
  </Fld>
);
const SW = ({ label, value, onChange }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 12px",
      background: "#0F172A",
      borderRadius: 8,
      border: "1px solid #334155",
      marginBottom: 10,
    }}
  >
    <span style={{ fontSize: 12, color: "#CBD5E1" }}>{label}</span>
    <button
      onClick={() => onChange(!value)}
      style={{
        padding: "3px 14px",
        borderRadius: 20,
        border: "none",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 11,
        background: value ? "#EF444420" : "#22C55E20",
        color: value ? "#EF4444" : "#22C55E",
      }}
    >
      {value ? "YES" : "NO"}
    </button>
  </div>
);

const CARD = {
  background: "#1E293B",
  borderRadius: 12,
  border: "1px solid #334155",
  padding: "18px 20px",
};

// ── LOGIN PAGE ─────────────────────────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loginGoogle() {
    setLoading(true);
    setErr("");
    try {
      await api.signInWithGoogle();
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070C14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(14,165,233,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.04) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle,rgba(14,165,233,.08) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          background: "#0F1A2A",
          borderRadius: 20,
          border: "1px solid #1E3A5F",
          padding: "48px 44px",
          width: 400,
          boxShadow: "0 32px 80px #00000070",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: "linear-gradient(135deg,#0EA5E9,#8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(14,165,233,.3)",
            }}
          >
            🏭
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#F0F8FF",
              letterSpacing: "-.3px",
            }}
          >
            WMS Approval System
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#475569",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Private access · Company accounts only
            <br />
            Powered by Google Workspace
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            border: "none",
            borderTop: "1px solid #1E3A5F",
            margin: "0 0 24px",
          }}
        />

        <button
          onClick={loginGoogle}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px 20px",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            background: "#fff",
            color: "#1F2937",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: "0 4px 16px #00000040",
            transition: "transform .15s,box-shadow .15s",
            opacity: loading ? 0.7 : 1,
            fontFamily: "inherit",
          }}
        >
          {/* Google Icon */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path
              fill="#4285F4"
              d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
            />
            <path
              fill="#34A853"
              d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
            />
            <path
              fill="#FBBC05"
              d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
            />
            <path
              fill="#EA4335"
              d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
            />
          </svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        {err && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "#EF444415",
              border: "1px solid #EF444440",
              borderRadius: 8,
              color: "#F87171",
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 11,
            color: "#334155",
            lineHeight: 1.7,
          }}
        >
          No self-registration · Only authorised company emails
          <br />
          Contact your system Admin to get access
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard({ stats, requests }) {
  if (!stats)
    return (
      <div style={{ color: "#64748B", padding: 40, textAlign: "center" }}>
        Loading dashboard…
      </div>
    );
  const KCard = ({ label, val, color, icon }) => (
    <div
      style={{
        ...CARD,
        borderLeft: "3px solid " + color,
        flex: "1 1 130px",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div
        style={{ fontSize: 28, fontWeight: 800, color, margin: "4px 0 2px" }}
      >
        {val}
      </div>
      <div style={{ fontSize: 11, color: "#64748B" }}>{label}</div>
    </div>
  );
  const pendingByLevel = [
    "Pending Manager",
    "Pending Operation Head",
    "Pending IT Review",
    "Pending HOD",
    "Pending VP",
  ].map((s) => ({ s, count: requests.filter((r) => r.status === s).length }));

  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "#E2E8F0",
          marginBottom: 22,
        }}
      >
        📊 Dashboard
      </div>
      <div
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}
      >
        <KCard
          label="Total Requests"
          val={stats.total}
          color="#0EA5E9"
          icon="📁"
        />
        <KCard label="Pending" val={stats.pending} color="#FBBF24" icon="⏳" />
        <KCard
          label="Approved"
          val={stats.approved}
          color="#34D399"
          icon="✅"
        />
        <KCard
          label="Rejected"
          val={stats.rejected}
          color="#F87171"
          icon="❌"
        />
        <KCard
          label="In Development"
          val={stats.inDev}
          color="#38BDF8"
          icon="🔨"
        />
        <KCard label="WMS Requests" val={stats.wms} color="#8B5CF6" icon="🏭" />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        <div style={CARD}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#94A3B8",
              marginBottom: 14,
            }}
          >
            By Category
          </div>
          {stats.byCategory.map(({ category, count }) => (
            <div key={category} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: "#CBD5E1" }}>
                  {CAT_I[category]} {category}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: CAT_C[category],
                  }}
                >
                  {count}
                </span>
              </div>
              <div
                style={{ height: 5, background: "#0F172A", borderRadius: 4 }}
              >
                <div
                  style={{
                    height: 5,
                    background: CAT_C[category],
                    borderRadius: 4,
                    width: stats.total
                      ? (count / stats.total) * 100 + "%"
                      : "0%",
                    transition: "width .4s",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={CARD}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#94A3B8",
              marginBottom: 14,
            }}
          >
            ⏳ Pending by Level
          </div>
          {pendingByLevel.map(({ s, count }) => (
            <div
              key={s}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                padding: "6px 10px",
                background: "#0F172A",
                borderRadius: 6,
                border: "1px solid #1E293B",
              }}
            >
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                {s.replace("Pending ", "")}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: count > 0 ? "#FBBF24" : "#334155",
                }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
        <div style={CARD}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#94A3B8",
              marginBottom: 14,
            }}
          >
            🕵️ Recent Activity
          </div>
          {(stats.recentAudit || []).slice(0, 8).map((a, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #0F172A",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: a.action?.includes("Approved")
                      ? "#34D399"
                      : a.action?.includes("Rejected")
                      ? "#F87171"
                      : "#60A5FA",
                  }}
                >
                  {a.action}
                </span>
                <span style={{ fontSize: 10, color: "#475569" }}>
                  #{a.request_id}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#475569" }}>
                {a.performed_by} ·{" "}
                {new Date(a.created_at).toLocaleDateString("en-MY")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── REQUEST FORM ───────────────────────────────────────────────────────────────
const BLANK = {
  title: "",
  mainCategory: "Application",
  subCategory: "New Internal App",
  department: DEPTS[0],
  country: COUNTRIES[0],
  warehouse: WAREHOUSES[0],
  priority: "Medium",
  riskLevel: "Low",
  businessProblem: "",
  currentProcess: "",
  proposedSolution: "",
  expectedBenefit: "",
  kpiImpact: "",
  estimatedUsers: 1,
  estimatedDays: 5,
  integrationRequired: false,
  wmsImpacted: false,
  apiRequired: false,
  downtimeRisk: false,
  rollbackRequired: false,
  status: "Pending Manager",
};

function RequestForm({ initial, isNew, onSave, onClose, isAdmin }) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const vp = needsVP(form);

  async function save() {
    if (!form.title.trim()) return alert("Title is required");
    setSaving(true);
    try {
      await onSave(form, isNew);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        style={{
          background: "#0F172A",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          border: "1px solid " + (vp ? "#EC489940" : "#0EA5E940"),
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: vp ? "#EC4899" : "#0EA5E9",
          }}
        >
          {vp
            ? "⚡ HIGH-IMPACT — Requires VP approval (L1→L2→L3→L4→VP→Approved)"
            : "✅ STANDARD — L1→L2→L3→L4→Approved"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              borderBottom: "1px solid #334155",
              paddingBottom: 6,
              marginBottom: 12,
            }}
          >
            REQUEST INFO
          </div>
          <SI
            label="Request Title *"
            value={form.title}
            onChange={(v) => set("title", v)}
          />
          <SS
            label="Main Category *"
            value={form.mainCategory}
            onChange={(v) => {
              set("mainCategory", v);
              set("subCategory", CATS[v][0]);
            }}
            options={Object.keys(CATS)}
          />
          <SS
            label="Sub-Category *"
            value={form.subCategory}
            onChange={(v) => set("subCategory", v)}
            options={CATS[form.mainCategory] || []}
          />
          <SS
            label="Department"
            value={form.department}
            onChange={(v) => set("department", v)}
            options={DEPTS}
          />
          <SS
            label="Country"
            value={form.country}
            onChange={(v) => set("country", v)}
            options={COUNTRIES}
          />
          <SS
            label="Warehouse"
            value={form.warehouse}
            onChange={(v) => set("warehouse", v)}
            options={WAREHOUSES}
          />
          <SS
            label="Priority"
            value={form.priority}
            onChange={(v) => set("priority", v)}
            options={PRIORITIES}
          />
          <SS
            label="Risk Level"
            value={form.riskLevel}
            onChange={(v) => set("riskLevel", v)}
            options={RISKS}
          />
          <SI
            label="Est. Users"
            value={form.estimatedUsers}
            onChange={(v) => set("estimatedUsers", v)}
            type="number"
          />
          <SI
            label="Est. Dev Days"
            value={form.estimatedDays}
            onChange={(v) => set("estimatedDays", v)}
            type="number"
          />
          {isAdmin && !isNew && (
            <SS
              label="⚡ Admin: Status Override"
              value={form.status}
              onChange={(v) => set("status", v)}
              options={STATUSES}
            />
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              borderBottom: "1px solid #334155",
              paddingBottom: 6,
              marginBottom: 12,
            }}
          >
            BUSINESS CASE
          </div>
          <ST
            label="Business Problem *"
            value={form.businessProblem}
            onChange={(v) => set("businessProblem", v)}
          />
          <ST
            label="Current Process"
            value={form.currentProcess}
            onChange={(v) => set("currentProcess", v)}
          />
          <ST
            label="Proposed Solution *"
            value={form.proposedSolution}
            onChange={(v) => set("proposedSolution", v)}
          />
          <ST
            label="Expected Benefit"
            value={form.expectedBenefit}
            onChange={(v) => set("expectedBenefit", v)}
          />
          <ST
            label="KPI Impact"
            value={form.kpiImpact}
            onChange={(v) => set("kpiImpact", v)}
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              borderBottom: "1px solid #334155",
              paddingBottom: 6,
              marginBottom: 10,
            }}
          >
            TECHNICAL FLAGS
          </div>
          <SW
            label="Integration Required?"
            value={form.integrationRequired}
            onChange={(v) => set("integrationRequired", v)}
          />
          <SW
            label="WMS Impacted?"
            value={form.wmsImpacted}
            onChange={(v) => set("wmsImpacted", v)}
          />
          <SW
            label="API Required?"
            value={form.apiRequired}
            onChange={(v) => set("apiRequired", v)}
          />
          <SW
            label="Downtime Risk?"
            value={form.downtimeRisk}
            onChange={(v) => set("downtimeRisk", v)}
          />
          <SW
            label="Rollback Required?"
            value={form.rollbackRequired}
            onChange={(v) => set("rollbackRequired", v)}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 20,
          borderTop: "1px solid #334155",
          paddingTop: 16,
        }}
      >
        <Btn onClick={save} color="#0EA5E9" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Submit Request →" : "Save Changes"}
        </Btn>
        <Btn onClick={onClose} color="#475569" outline>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

// ── REQUESTS ───────────────────────────────────────────────────────────────────
function Requests({ user, requests, setRequests, showToast }) {
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState("All");
  const [fSta, setFSta] = useState("All");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [delId, setDelId] = useState(null);
  const [actReq, setActReq] = useState(null);
  const [actType, setActType] = useState("");
  const [actNote, setActNote] = useState("");

  const isAdmin = user.role === "Admin";
  const canApprove = [
    "Department Manager",
    "Operation Head",
    "IT Team",
    "HOD",
    "VP",
    "Admin",
  ].includes(user.role);

  const filtered = requests.filter(
    (r) =>
      (fCat === "All" || r.category === fCat) &&
      (fSta === "All" || r.status === fSta) &&
      (search === "" ||
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        String(r.id).includes(search))
  );

  async function handleSave(form, isNew) {
    try {
      const vp = needsVP(form);
      const payload = {
        title: form.title,
        category: form.mainCategory,
        sub_category: form.subCategory,
        department: form.department,
        country: form.country,
        warehouse: form.warehouse,
        priority: form.priority,
        risk_level: form.riskLevel,
        vp_required: vp,
        estimated_days: form.estimatedDays,
        estimated_users: form.estimatedUsers,
        integration_req: form.integrationRequired,
        wms_impacted: form.wmsImpacted,
        api_required: form.apiRequired,
        downtime_risk: form.downtimeRisk,
        rollback_req: form.rollbackRequired,
        business_problem: form.businessProblem,
        current_process: form.currentProcess,
        proposed_solution: form.proposedSolution,
        expected_benefit: form.expectedBenefit,
        kpi_impact: form.kpiImpact,
      };
      if (isNew) {
        payload.requestor_id = user.id;
        payload.requestor_name = user.name;
        payload.status = "Pending Manager";
        const d = await api.createRequest(payload);
        setRequests((r) => [d, ...r]);
        await api.addAudit(d.id, "Created", user.name, "Request submitted");
        showToast("Request submitted ✅", "green");
      } else {
        if (isAdmin) payload.status = form.status;
        const d = await api.updateRequest(editing.id, payload);
        setRequests((r) => r.map((x) => (x.id === editing.id ? d : x)));
        await api.addAudit(editing.id, "Edited", user.name, "Request updated");
        showToast("Updated ✅", "green");
      }
      setEditing(null);
      setShowNew(false);
    } catch (e) {
      showToast(e.message, "red");
    }
  }

  async function handleAction() {
    try {
      const current = actReq.status;
      const ns = NEXT_STATUS[current];
      if (actType === "approve" && ns) {
        const next = actReq.vp_required ? ns.vp : ns.normal;
        await api.updateRequest(actReq.id, { status: next });
        await api.addAudit(
          actReq.id,
          "Approved L" + ns.level,
          user.name,
          actNote || "Approved"
        );
        setRequests((r) =>
          r.map((x) => (x.id === actReq.id ? { ...x, status: next } : x))
        );
        showToast("Approved → " + next, "green");
      } else {
        await api.updateRequest(actReq.id, { status: "Rejected" });
        await api.addAudit(
          actReq.id,
          "Rejected",
          user.name,
          actNote || "No reason given"
        );
        setRequests((r) =>
          r.map((x) => (x.id === actReq.id ? { ...x, status: "Rejected" } : x))
        );
        showToast("Request rejected", "red");
      }
    } catch (e) {
      showToast(e.message, "red");
    } finally {
      setActReq(null);
      setActNote("");
    }
  }

  async function handleDelete() {
    try {
      await api.deleteRequest(delId);
      setRequests((r) => r.filter((x) => x.id !== delId));
      showToast("Deleted", "green");
    } catch (e) {
      showToast(e.message, "red");
    } finally {
      setDelId(null);
    }
  }

  async function handleOverride(reqId, status) {
    try {
      await api.updateRequest(reqId, { status });
      await api.addAudit(
        reqId,
        "Admin Override",
        user.name,
        "Status set to: " + status
      );
      setRequests((r) => r.map((x) => (x.id === reqId ? { ...x, status } : x)));
      setViewing((v) => (v ? { ...v, status } : v));
      showToast("Status updated", "green");
    } catch (e) {
      showToast(e.message, "red");
    }
  }

  function toEditForm(r) {
    return {
      ...r,
      mainCategory: r.category,
      subCategory: r.sub_category,
      estimatedDays: r.estimated_days,
      estimatedUsers: r.estimated_users,
      riskLevel: r.risk_level,
      integrationRequired: r.integration_req,
      wmsImpacted: r.wms_impacted,
      apiRequired: r.api_required,
      downtimeRisk: r.downtime_risk,
      rollbackRequired: r.rollback_req,
      businessProblem: r.business_problem,
      currentProcess: r.current_process,
      proposedSolution: r.proposed_solution,
      expectedBenefit: r.expected_benefit,
      kpiImpact: r.kpi_impact,
    };
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0" }}>
          📋 Requests
        </div>
        <Btn onClick={() => setShowNew(true)}>+ New Request</Btn>
      </div>
      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or ID…"
          style={{ ...INP, flex: "1 1 200px", width: "auto" }}
        />
        <select
          value={fCat}
          onChange={(e) => setFCat(e.target.value)}
          style={{ ...INP, width: "auto" }}
        >
          <option value="All">All Categories</option>
          {Object.keys(CATS).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={fSta}
          onChange={(e) => setFSta(e.target.value)}
          style={{ ...INP, width: "auto" }}
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
        {filtered.length} requests
      </div>
      <div
        style={{
          background: "#1E293B",
          borderRadius: 12,
          border: "1px solid #334155",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 110px 90px 180px 180px",
            background: "#0F172A",
            padding: "10px 16px",
            gap: 8,
          }}
        >
          {["ID", "Title", "Category", "Priority", "Status", "Actions"].map(
            (h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {h}
              </div>
            )
          )}
        </div>
        {filtered.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 110px 90px 180px 180px",
              padding: "10px 16px",
              gap: 8,
              alignItems: "center",
              background: i % 2 === 0 ? "#1E293B" : "#192132",
              borderTop: "1px solid #0F172A",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#60A5FA" }}>
              #{r.id}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1" }}>
                {r.title}
              </div>
              <div style={{ fontSize: 10, color: "#475569" }}>
                {r.sub_category} · {r.country}
              </div>
            </div>
            <Tag label={r.category} color={CAT_C[r.category] || "#94A3B8"} />
            <Tag label={r.priority} color={PRI_C[r.priority] || "#94A3B8"} />
            <Sta s={r.status} />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <button
                onClick={() => setViewing(r)}
                style={{
                  padding: "3px 9px",
                  borderRadius: 5,
                  background: "#0EA5E920",
                  border: "1px solid #0EA5E940",
                  color: "#0EA5E9",
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                View
              </button>
              {canApprove && r.status.startsWith("Pending") && (
                <>
                  <button
                    onClick={() => {
                      setActReq(r);
                      setActType("approve");
                    }}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 5,
                      background: "#34D39920",
                      border: "1px solid #34D39940",
                      color: "#34D399",
                      fontSize: 10,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => {
                      setActReq(r);
                      setActType("reject");
                    }}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 5,
                      background: "#EF444420",
                      border: "1px solid #EF444440",
                      color: "#EF4444",
                      fontSize: 10,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ✕ Reject
                  </button>
                </>
              )}
              {isAdmin && (
                <button
                  onClick={() => setEditing(toEditForm(r))}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 5,
                    background: "#F59E0B20",
                    border: "1px solid #F59E0B40",
                    color: "#F59E0B",
                    fontSize: 10,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Edit
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setDelId(r.id)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 5,
                    background: "#EF444415",
                    border: "1px solid #EF444430",
                    color: "#EF4444",
                    fontSize: 10,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Del
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>
            No requests found.
          </div>
        )}
      </div>

      {/* MODALS */}
      {showNew && (
        <Modal title="✍️ New Request" onClose={() => setShowNew(false)} wide>
          <RequestForm
            isNew
            initial={BLANK}
            onSave={handleSave}
            onClose={() => setShowNew(false)}
            isAdmin={isAdmin}
          />
        </Modal>
      )}
      {editing && (
        <Modal
          title={"✏️ Edit #" + editing.id}
          onClose={() => setEditing(null)}
          wide
        >
          <RequestForm
            initial={editing}
            onSave={handleSave}
            onClose={() => setEditing(null)}
            isAdmin={isAdmin}
          />
        </Modal>
      )}

      {viewing && (
        <Modal
          title={"#" + viewing.id + " — " + viewing.title}
          onClose={() => setViewing(null)}
          wide
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <Tag
              label={viewing.category}
              color={CAT_C[viewing.category] || "#94A3B8"}
            />
            <Tag
              label={viewing.sub_category}
              color={CAT_C[viewing.category] || "#94A3B8"}
            />
            <Sta s={viewing.status} />
            <Tag
              label={viewing.priority}
              color={PRI_C[viewing.priority] || "#94A3B8"}
            />
            {viewing.vp_required && (
              <Tag label="⚡ VP Required" color="#EC4899" />
            )}
          </div>
          {isAdmin && (
            <div
              style={{
                background: "#0F172A",
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 14,
                border: "1px solid #F59E0B30",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#F59E0B",
                  marginBottom: 8,
                }}
              >
                ⚡ Admin: Override Status
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    onClick={() => handleOverride(viewing.id, st)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 700,
                      background:
                        viewing.status === st
                          ? (STA_C[st] || "#64748B") + "44"
                          : "transparent",
                      border: "1px solid " + (STA_C[st] || "#64748B") + "55",
                      color: STA_C[st] || "#64748B",
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={CARD}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: 10,
                }}
              >
                REQUEST DETAILS
              </div>
              {[
                ["Requestor", viewing.requestor_name],
                ["Submitted", viewing.submitted_date],
                ["Department", viewing.department],
                ["Country", viewing.country],
                ["Warehouse", viewing.warehouse],
                ["Est. Users", viewing.estimated_users],
                ["Est. Days", viewing.estimated_days + "d"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #0F172A",
                    paddingBottom: 5,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#64748B" }}>{k}</span>
                  <span
                    style={{ fontSize: 11, color: "#CBD5E1", fontWeight: 600 }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
            <div style={CARD}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: 10,
                }}
              >
                TECHNICAL FLAGS
              </div>
              {[
                ["Integration Req", viewing.integration_req],
                ["WMS Impacted", viewing.wms_impacted],
                ["API Required", viewing.api_required],
                ["Downtime Risk", viewing.downtime_risk],
                ["Rollback Req", viewing.rollback_req],
                ["VP Required", viewing.vp_required],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #0F172A",
                    paddingBottom: 5,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#64748B" }}>{k}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: v ? "#F87171" : "#34D399",
                    }}
                  >
                    {v ? "⚠ YES" : "✓ NO"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {[
            ["Business Problem", viewing.business_problem],
            ["Proposed Solution", viewing.proposed_solution],
            ["Expected Benefit", viewing.expected_benefit],
            ["KPI Impact", viewing.kpi_impact],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} style={{ ...CARD, marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    marginBottom: 6,
                  }}
                >
                  {k.toUpperCase()}
                </div>
                <div
                  style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}
                >
                  {v}
                </div>
              </div>
            ))}
        </Modal>
      )}

      {delId && (
        <Modal title="⚠️ Delete Request" onClose={() => setDelId(null)}>
          <p style={{ color: "#94A3B8", fontSize: 13, marginBottom: 20 }}>
            Delete request{" "}
            <strong style={{ color: "#F87171" }}>#{delId}</strong>? This cannot
            be undone.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={handleDelete} color="#EF4444">
              Delete
            </Btn>
            <Btn onClick={() => setDelId(null)} color="#475569" outline>
              Cancel
            </Btn>
          </div>
        </Modal>
      )}

      {actReq && (
        <Modal
          title={
            (actType === "approve" ? "✅ Approve" : "❌ Reject") +
            " Request #" +
            actReq.id
          }
          onClose={() => {
            setActReq(null);
            setActNote("");
          }}
        >
          <p style={{ color: "#94A3B8", fontSize: 13, marginBottom: 4 }}>
            <strong style={{ color: "#CBD5E1" }}>{actReq.title}</strong>
          </p>
          <p style={{ color: "#475569", fontSize: 12, marginBottom: 16 }}>
            {actReq.sub_category} · {actReq.country} · Priority:{" "}
            {actReq.priority}
          </p>
          {actType === "approve" ? (
            <div
              style={{
                background: "#0F172A",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 14,
                border: "1px solid #34D39940",
              }}
            >
              <div style={{ fontSize: 11, color: "#34D399", fontWeight: 700 }}>
                Next status:{" "}
                {actReq.vp_required
                  ? NEXT_STATUS[actReq.status]?.vp
                  : NEXT_STATUS[actReq.status]?.normal}
              </div>
            </div>
          ) : null}
          <ST
            label={
              actType === "approve"
                ? "Comment (optional)"
                : "Reason for rejection *"
            }
            value={actNote}
            onChange={setActNote}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Btn
              onClick={handleAction}
              color={actType === "approve" ? "#34D399" : "#EF4444"}
            >
              {actType === "approve" ? "Confirm Approve" : "Confirm Reject"}
            </Btn>
            <Btn
              onClick={() => {
                setActReq(null);
                setActNote("");
              }}
              color="#475569"
              outline
            >
              Cancel
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── USERS ──────────────────────────────────────────────────────────────────────
function Users({ users, setUsers, showToast }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = users.filter(
    (u) =>
      search === "" ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function save(form) {
    try {
      const d = await api.updateUserRole(form.id, {
        role: form.role,
        department: form.department,
        country: form.country,
        warehouse: form.warehouse,
        active: form.active,
      });
      setUsers((u) => u.map((x) => (x.id === form.id ? { ...x, ...d } : x)));
      showToast("User updated ✅", "green");
      setEditing(null);
    } catch (e) {
      showToast(e.message, "red");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0" }}>
          👥 User Management
        </div>
        <div style={{ fontSize: 12, color: "#475569" }}>
          Users sign in with Google · Manage roles & access here
        </div>
      </div>
      <div
        style={{
          background: "#1E3A5F22",
          border: "1px solid #1E3A5F",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 12,
          color: "#93C5FD",
        }}
      >
        💡 When a team member signs in with their company Google account for the
        first time, they appear here as <strong>Requestor</strong>. Change their
        role to give them approval access.
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email…"
        style={{ ...INP, maxWidth: 360, marginBottom: 16 }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 14,
        }}
      >
        {filtered.map((u) => (
          <div
            key={u.id}
            style={{
              ...CARD,
              borderLeft: "3px solid " + (ROL_C[u.role] || "#475569"),
              opacity: u.active ? 1 : 0.55,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 14, fontWeight: 800, color: "#E2E8F0" }}
                >
                  {u.name || "—"}
                </div>
                <div style={{ fontSize: 11, color: "#64748B" }}>{u.email}</div>
              </div>
              <Tag
                label={u.role || "Requestor"}
                color={ROL_C[u.role] || "#94A3B8"}
              />
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>
              {u.department || "—"} · {u.country || "—"} · {u.warehouse || "—"}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: u.active ? "#34D39920" : "#EF444420",
                  color: u.active ? "#34D399" : "#EF4444",
                  fontWeight: 700,
                }}
              >
                {u.active ? "Active" : "Inactive"}
              </span>
              <button
                onClick={() => setEditing({ ...u })}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  background: "#F59E0B20",
                  border: "1px solid #F59E0B40",
                  color: "#F59E0B",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Edit Role
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={"Edit — " + editing.name}
          onClose={() => setEditing(null)}
        >
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
            {editing.email}
          </div>
          <SS
            label="Role"
            value={editing.role || "Requestor"}
            onChange={(v) => setEditing((e) => ({ ...e, role: v }))}
            options={ROLES}
          />
          <SS
            label="Department"
            value={editing.department || DEPTS[0]}
            onChange={(v) => setEditing((e) => ({ ...e, department: v }))}
            options={DEPTS}
          />
          <SS
            label="Country"
            value={editing.country || COUNTRIES[0]}
            onChange={(v) => setEditing((e) => ({ ...e, country: v }))}
            options={COUNTRIES}
          />
          <SS
            label="Warehouse"
            value={editing.warehouse || WAREHOUSES[0]}
            onChange={(v) => setEditing((e) => ({ ...e, warehouse: v }))}
            options={WAREHOUSES}
          />
          <SW
            label="Active?"
            value={editing.active ?? true}
            onChange={(v) => setEditing((e) => ({ ...e, active: v }))}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn onClick={() => save(editing)} color="#10B981">
              Save
            </Btn>
            <Btn onClick={() => setEditing(null)} color="#475569" outline>
              Cancel
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── AUDIT LOG ──────────────────────────────────────────────────────────────────
function AuditLog({ requests }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .getAuditLog()
      .then((d) => {
        setLog(d || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  const ACTION_C = {
    Created: "#34D399",
    Edited: "#FBBF24",
    Deleted: "#F87171",
    "Admin Override": "#A78BFA",
    "SLA Alert": "#F97316",
  };
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "#E2E8F0",
          marginBottom: 20,
        }}
      >
        🕵️ Audit Log
      </div>
      {loading ? (
        <div style={{ color: "#64748B", padding: 40, textAlign: "center" }}>
          Loading…
        </div>
      ) : (
        <div
          style={{
            background: "#1E293B",
            borderRadius: 12,
            border: "1px solid #334155",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 130px 80px 100px 1fr",
              background: "#0F172A",
              padding: "10px 16px",
              gap: 8,
            }}
          >
            {["Timestamp", "User", "Req ID", "Action", "Detail"].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {log.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 130px 80px 100px 1fr",
                padding: "10px 16px",
                gap: 8,
                alignItems: "center",
                background: i % 2 === 0 ? "#1E293B" : "#192132",
                borderTop: "1px solid #0F172A",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748B" }}>
                {new Date(a.created_at).toLocaleString("en-MY")}
              </div>
              <div style={{ fontSize: 11, color: "#CBD5E1", fontWeight: 600 }}>
                {a.performed_by}
              </div>
              <div style={{ fontSize: 11, color: "#60A5FA" }}>
                #{a.request_id}
              </div>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: (ACTION_C[a.action] || "#94A3B8") + "20",
                  color: ACTION_C[a.action] || "#94A3B8",
                  fontWeight: 700,
                }}
              >
                {a.action}
              </span>
              <div style={{ fontSize: 11, color: "#64748B" }}>{a.detail}</div>
            </div>
          ))}
          {log.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>
              No audit records yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  function showToast(msg, color = "green") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load profile when session exists
  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    api
      .getProfile(session.user.id)
      .then(setProfile)
      .catch(() =>
        setProfile({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email,
          email: session.user.email,
          role: "Requestor",
        })
      );
  }, [session]);

  // Load data when profile ready
  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const [reqs, dash] = await Promise.all([
        api.getRequests(),
        api.getDashboardStats(),
      ]);
      setRequests(reqs || []);
      setStats(dash);
      if (profile.role === "Admin") {
        const us = await api.getUsers();
        setUsers(us || []);
      }
    } catch (e) {
      showToast(e.message, "red");
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (session === undefined)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070C14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontFamily: "inherit",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>Loading…
        </div>
      </div>
    );
  if (!session) return <LoginPage />;
  if (!profile)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070C14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontFamily: "inherit",
        }}
      >
        Setting up your account…
      </div>
    );

  const isAdmin = profile.role === "Admin";
  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "requests", label: "Requests", icon: "📋" },
    { id: "users", label: "Users", icon: "👥", admin: true },
    { id: "audit", label: "Audit Log", icon: "🕵️", admin: true },
  ];
  const myTabs = TABS.filter((t) => !t.admin || isAdmin);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070C14",
        fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
        color: "#E2E8F0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 999,
            background: toast.color === "green" ? "#064E3B" : "#7F1D1D",
            border:
              "1px solid " + (toast.color === "green" ? "#34D399" : "#F87171"),
            color: toast.color === "green" ? "#6EE7B7" : "#FCA5A5",
            padding: "10px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 8px 24px #00000060",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* TOP BAR */}
      <div
        style={{
          background: "#0A0F1A",
          borderBottom: "1px solid #1E293B",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 52,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginRight: 32,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg,#0EA5E9,#8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
            }}
          >
            🏭
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#E2E8F0",
                lineHeight: 1,
              }}
            >
              WMS Approval
            </div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1.5 }}>
              PRIVATE · TEAM ACCESS
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          {myTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "0 14px",
                height: 52,
                background: "transparent",
                border: "none",
                borderBottom:
                  "2px solid " + (tab === t.id ? "#0EA5E9" : "transparent"),
                color: tab === t.id ? "#0EA5E9" : "#64748B",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              {t.icon} {t.label}
              {t.admin && (
                <span
                  style={{
                    fontSize: 9,
                    background: "#F59E0B22",
                    color: "#F59E0B",
                    padding: "1px 5px",
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  ADMIN
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>
              {profile.name}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: ROL_C[profile.role] || "#64748B",
              }}
            >
              {profile.role}
            </div>
          </div>
          <button
            onClick={() => api.signOut()}
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              background: "transparent",
              border: "1px solid #334155",
              color: "#64748B",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {isAdmin && (
        <div
          style={{
            background: "linear-gradient(90deg,#0EA5E9,#8B5CF6)",
            padding: "5px 24px",
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 0.5,
          }}
        >
          🔑 ADMIN MODE — Full access · Edit · Status override · User management
          · Audit log
        </div>
      )}

      <div
        style={{
          flex: 1,
          padding: "28px",
          maxWidth: 1320,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {tab === "dashboard" && <Dashboard stats={stats} requests={requests} />}
        {tab === "requests" && (
          <Requests
            user={profile}
            requests={requests}
            setRequests={setRequests}
            showToast={showToast}
          />
        )}
        {tab === "users" && isAdmin && (
          <Users users={users} setUsers={setUsers} showToast={showToast} />
        )}
        {tab === "audit" && isAdmin && <AuditLog requests={requests} />}
      </div>

      <div
        style={{
          borderTop: "1px solid #1E293B",
          padding: "10px 24px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#334155",
        }}
      >
        <span>
          WMS Approval System · Private · {profile.role} · Powered by Supabase +
          Vercel
        </span>
        <span>
          {requests.length} requests · {stats?.pending || 0} pending
        </span>
      </div>
    </div>
  );
}
