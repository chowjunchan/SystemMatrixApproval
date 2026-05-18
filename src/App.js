import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import * as api from './api';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const DEPARTMENTS = ['SPO-EU', 'SPO-SEA', 'GCE', 'WSI', 'SDO'];

const CONTINENTS = {
  EU:  ['Poland', 'Turkey', 'Spain'],
  SEA: ['Vietnam', 'Bangladesh', 'India', 'Philippines', 'Indonesia', 'Cambodia'],
};
const ALL_COUNTRIES = [...CONTINENTS.EU, ...CONTINENTS.SEA];

const WAREHOUSE_MAP = {
  Poland: 'PLHQ', Turkey: 'TRHQ', Spain: 'SPHQ',
  Vietnam: 'VNHQ', Bangladesh: 'BDHQ', India: 'INHQ',
  Philippines: 'PHHQ', Indonesia: 'IDHQ', Cambodia: 'KHHQ',
};

const CATS = {
  Application: ['New Internal App', 'Mobile Scanning App'],
  WMS: ['In-house WMS', 'WMS Enhancement', 'WMS Integration', 'API Integration'],
  Automation: ['JavaScript Automation', 'Node Automation', 'Process Automation'],
  Dashboard: ['Live Dashboard', 'KPI Dashboard', 'Productivity Dashboard', 'Operational Dashboard'],
  Report: ['Operational Report', 'Exception Report', 'KPI Report', 'Management Report'],
};

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const RISKS      = ['Critical', 'High', 'Medium', 'Low'];

// ── APPROVAL FLOW ──────────────────────────────────────────────────────────────
// Flow: Requestor → Continent Manager → Country Manager → SDO Manager → HOD → VP (skip if Low)
// Status names:
const STATUS_FLOW_FULL = [
  'Pending Continent Manager',
  'Pending Country Manager',
  'Pending SDO Manager',
  'Pending HOD',
  'Pending VP',
  'Approved',
];
const STATUS_FLOW_LOW = [
  'Pending Continent Manager',
  'Pending Country Manager',
  'Pending SDO Manager',
  'Pending HOD',
  'Approved',
];

// Dev timeline statuses (after approval)
const DEV_STATUSES = [
  'Approved',
  'Timeline Set',
  'In Development',
  'Testing',
  'UAT',
  'Pending Go Live',
  'Go Live',
  'Completed',
  'Rejected',
  'Revision Required',
  'On Hold',
];

const ALL_STATUSES = [
  'Pending Continent Manager',
  'Pending Country Manager',
  'Pending SDO Manager',
  'Pending HOD',
  'Pending VP',
  ...DEV_STATUSES,
];

function getFlow(priority) {
  return priority === 'Low' ? STATUS_FLOW_LOW : STATUS_FLOW_FULL;
}

function nextStatus(current, priority) {
  const flow = getFlow(priority);
  const idx  = flow.indexOf(current);
  return idx >= 0 ? (flow[idx + 1] || 'Approved') : 'Approved';
}

function getContinent(country) {
  if (CONTINENTS.EU.includes(country))  return 'EU';
  if (CONTINENTS.SEA.includes(country)) return 'SEA';
  return 'SEA';
}

// ── COLORS ────────────────────────────────────────────────────────────────────
const CAT_C  = { Application:'#0EA5E9', WMS:'#8B5CF6', Automation:'#F59E0B', Dashboard:'#10B981', Report:'#EC4899' };
const CAT_I  = { Application:'💻', WMS:'🏭', Automation:'⚙️', Dashboard:'📊', Report:'📋' };
const PRI_C  = { Critical:'#EF4444', High:'#F97316', Medium:'#EAB308', Low:'#22C55E' };
const ROL_C  = { Requestor:'#60A5FA', 'Continent Manager':'#F59E0B', 'Country Manager':'#FB923C', 'SDO Manager':'#A78BFA', HOD:'#F472B6', VP:'#EC4899', Admin:'#34D399', 'IT Team':'#38BDF8' };
const STA_C  = {
  'Pending Continent Manager':'#F59E0B',
  'Pending Country Manager':'#FB923C',
  'Pending SDO Manager':'#A78BFA',
  'Pending HOD':'#F472B6',
  'Pending VP':'#EC4899',
  Approved:'#34D399',
  'Timeline Set':'#38BDF8',
  'In Development':'#0EA5E9',
  Testing:'#818CF8',
  UAT:'#C084FC',
  'Pending Go Live':'#FB7185',
  'Go Live':'#4ADE80',
  Completed:'#34D399',
  Rejected:'#F87171',
  'Revision Required':'#FCD34D',
  'On Hold':'#94A3B8',
};

const LEVEL_MAP = {
  'Pending Continent Manager': { level:1, role:'Continent Manager' },
  'Pending Country Manager':   { level:2, role:'Country Manager' },
  'Pending SDO Manager':       { level:3, role:'SDO Manager' },
  'Pending HOD':               { level:4, role:'HOD' },
  'Pending VP':                { level:5, role:'VP' },
};

// ── CSV EXPORT ─────────────────────────────────────────────────────────────────
function exportToCSV(requests) {
  const headers = ['ID','Title','Category','Sub Category','Department','Country','Warehouse','Requestor','Priority','Risk Level','Status','Est Days','Est Users','Business Problem','Proposed Solution','Expected Benefit','Submitted Date','Dev Start','Testing Start','UAT Start','Go Live Date'];
  const rows = requests.map(r => [
    r.id, r.title, r.category, r.sub_category, r.department, r.country, r.warehouse,
    r.requestor_name, r.priority, r.risk_level, r.status,
    r.estimated_days, r.estimated_users,
    r.business_problem, r.proposed_solution, r.expected_benefit, r.submitted_date,
    r.dev_start||'', r.testing_start||'', r.uat_start||'', r.go_live_date||''
  ].map(v => `"${String(v||'').replace(/"/g,'""')}"`));
  const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`WMS_Requests_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase().replace(/ /g,'_'));
  return lines.slice(1).map(line => {
    const vals=[]; let cur='',inQ=false;
    for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){vals.push(cur);cur='';}else cur+=ch;}
    vals.push(cur);
    const obj={}; headers.forEach((h,i)=>obj[h]=(vals[i]||'').replace(/"/g,'').trim());
    return obj;
  });
}

// ── UI ATOMS ───────────────────────────────────────────────────────────────────
const INP={width:'100%',padding:'9px 12px',borderRadius:8,background:'#0F172A',border:'1px solid #334155',color:'#E2E8F0',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'};
const CARD={background:'#1E293B',borderRadius:12,border:'1px solid #334155',padding:'18px 20px'};

const Tag=({label,color})=><span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,background:color+'22',color,fontSize:10,fontWeight:700,border:'1px solid '+color+'44',whiteSpace:'nowrap'}}>{label}</span>;
const Sta=({s})=><Tag label={s} color={STA_C[s]||'#94A3B8'}/>;

function Btn({onClick,children,color='#0EA5E9',outline,sm,full,disabled}){
  return <button onClick={onClick} disabled={disabled} style={{padding:sm?'5px 12px':'9px 18px',borderRadius:8,cursor:disabled?'not-allowed':'pointer',fontWeight:700,fontSize:sm?11:13,border:'1.5px solid '+color,background:outline?'transparent':disabled?color+'44':color,color:outline?color:'#fff',fontFamily:'inherit',width:full?'100%':'auto',opacity:disabled?.6:1}}>{children}</button>;
}

function Modal({title,onClose,children,wide}){
  return <div style={{position:'fixed',inset:0,background:'#00000090',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:'#1E293B',borderRadius:16,border:'1px solid #334155',width:'100%',maxWidth:wide?980:540,maxHeight:'92vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 24px',borderBottom:'1px solid #334155',position:'sticky',top:0,background:'#1E293B',zIndex:1}}>
        <div style={{fontSize:15,fontWeight:800,color:'#E2E8F0'}}>{title}</div>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:'#64748B',fontSize:24,cursor:'pointer',lineHeight:1}}>×</button>
      </div>
      <div style={{padding:'20px 24px'}}>{children}</div>
    </div>
  </div>;
}

const Fld=({label,children})=><div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:700,color:'#64748B',display:'block',marginBottom:4}}>{label}</label>{children}</div>;
const SI=({label,value,onChange,type='text'})=><Fld label={label}><input type={type} value={value??''} onChange={e=>onChange(type==='number'?+e.target.value:e.target.value)} style={INP}/></Fld>;
const SS=({label,value,onChange,options})=><Fld label={label}><select value={value??''} onChange={e=>onChange(e.target.value)} style={INP}>{options.map(o=><option key={o}>{o}</option>)}</select></Fld>;
const ST=({label,value,onChange,rows=3})=><Fld label={label}><textarea value={value??''} onChange={e=>onChange(e.target.value)} rows={rows} style={{...INP,resize:'vertical'}}/></Fld>;
const SW=({label,value,onChange})=><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#0F172A',borderRadius:8,border:'1px solid #334155',marginBottom:10}}>
  <span style={{fontSize:12,color:'#CBD5E1'}}>{label}</span>
  <button onClick={()=>onChange(!value)} style={{padding:'3px 14px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:700,fontSize:11,background:value?'#EF444420':'#22C55E20',color:value?'#EF4444':'#22C55E'}}>{value?'YES':'NO'}</button>
</div>;

// ── COUNTRY SEARCH SELECT ──────────────────────────────────────────────────────
function CountrySelect({value, onChange}) {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = ALL_COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  const grouped  = {
    '🌍 Europe':    filtered.filter(c => CONTINENTS.EU.includes(c)),
    '🌏 Southeast Asia': filtered.filter(c => CONTINENTS.SEA.includes(c)),
  };

  function select(country) {
    onChange(country);
    setSearch('');
    setOpen(false);
  }

  return (
    <Fld label="Country *">
      <div ref={ref} style={{position:'relative'}}>
        <div onClick={()=>setOpen(o=>!o)} style={{...INP,display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none'}}>
          <span style={{color:value?'#E2E8F0':'#475569'}}>
            {value ? `${WAREHOUSE_MAP[value]?`[${WAREHOUSE_MAP[value]}] `:''}${value}` : 'Select country…'}
          </span>
          <span style={{fontSize:10,color:'#475569'}}>{open?'▲':'▼'}</span>
        </div>
        {open && (
          <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#1E293B',border:'1px solid #334155',borderRadius:10,zIndex:100,boxShadow:'0 8px 32px #00000060',maxHeight:280,overflowY:'auto'}}>
            <div style={{padding:'8px 10px',borderBottom:'1px solid #334155',position:'sticky',top:0,background:'#1E293B'}}>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search country…" style={{...INP,padding:'6px 10px',fontSize:12}}/>
            </div>
            {Object.entries(grouped).map(([grp,countries])=>countries.length>0&&(
              <div key={grp}>
                <div style={{fontSize:9,fontWeight:700,color:'#475569',padding:'8px 14px 4px',textTransform:'uppercase',letterSpacing:1}}>{grp}</div>
                {countries.map(c=>(
                  <div key={c} onClick={()=>select(c)} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:value===c?'#E2E8F0':'#94A3B8',background:value===c?'#0EA5E920':'transparent',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>{c}</span>
                    <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>{WAREHOUSE_MAP[c]}</span>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length===0&&<div style={{padding:'16px',textAlign:'center',color:'#475569',fontSize:12}}>No countries found</div>}
          </div>
        )}
      </div>
    </Fld>
  );
}

// ── APPROVAL FLOW VISUAL ───────────────────────────────────────────────────────
function ApprovalFlowBar({status, priority, country}) {
  const flow    = getFlow(priority);
  const current = flow.indexOf(status);
  const continent = getContinent(country);

  const labels = {
    'Pending Continent Manager': continent+' Manager',
    'Pending Country Manager':   'Country Mgr',
    'Pending SDO Manager':       'SDO Manager',
    'Pending HOD':               'HOD',
    'Pending VP':                'VP',
    'Approved':                  '✅ Approved',
  };

  return (
    <div style={{display:'flex',alignItems:'center',gap:0,flexWrap:'wrap',marginBottom:16}}>
      {flow.map((s,i)=>{
        const isDone = i < current || status==='Approved';
        const isActive = i === current;
        return (
          <div key={s} style={{display:'flex',alignItems:'center'}}>
            <div style={{padding:'5px 10px',borderRadius:6,fontSize:10,fontWeight:700,background:isDone?'#34D39920':isActive?'#0EA5E920':'#0F172A',color:isDone?'#34D399':isActive?'#0EA5E9':'#475569',border:'1px solid '+(isDone?'#34D39940':isActive?'#0EA5E940':'#334155')}}>
              {isDone&&i<flow.length-1?'✓ ':isActive?'▶ ':''}{labels[s]||s}
            </div>
            {i<flow.length-1&&<div style={{width:16,height:2,background:isDone?'#34D399':'#334155'}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ── DEV TIMELINE MODAL (IT Team sets dates) ────────────────────────────────────
function TimelineModal({request, onSave, onClose}) {
  const [form, setForm] = useState({
    dev_start:     request.dev_start     || '',
    testing_start: request.testing_start || '',
    uat_start:     request.uat_start     || '',
    go_live_date:  request.go_live_date  || '',
    dev_notes:     request.dev_notes     || '',
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const MILESTONES = [
    { key:'dev_start',     label:'🔨 Development Start',  color:'#0EA5E9' },
    { key:'testing_start', label:'🧪 Testing Start',       color:'#818CF8' },
    { key:'uat_start',     label:'✅ UAT Start',           color:'#C084FC' },
    { key:'go_live_date',  label:'🚀 Go Live Date',        color:'#4ADE80' },
  ];

  return (
    <Modal title={'📅 Set Development Timeline — #'+request.id} onClose={onClose}>
      <div style={{background:'#0F172A',borderRadius:8,padding:'10px 14px',marginBottom:16,border:'1px solid #38BDF840'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#38BDF8',marginBottom:4}}>Setting timeline for:</div>
        <div style={{fontSize:13,color:'#CBD5E1',fontWeight:600}}>{request.title}</div>
        <div style={{fontSize:11,color:'#64748B'}}>{request.category} · {request.country} · {request.priority}</div>
      </div>

      {MILESTONES.map(m=>(
        <div key={m.key} style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:'#64748B',display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <span style={{color:m.color}}>{m.label}</span>
          </label>
          <input type="date" value={form[m.key]} onChange={e=>set(m.key,e.target.value)} style={{...INP}}/>
        </div>
      ))}

      <ST label="Development Notes" value={form.dev_notes} onChange={v=>set('dev_notes',v)} rows={3}/>

      {/* Timeline visual preview */}
      {form.dev_start && (
        <div style={{background:'#0F172A',borderRadius:8,padding:'12px 14px',marginBottom:14,border:'1px solid #334155'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#64748B',marginBottom:10}}>TIMELINE PREVIEW</div>
          <div style={{display:'flex',gap:0,alignItems:'center'}}>
            {MILESTONES.filter(m=>form[m.key]).map((m,i,arr)=>(
              <div key={m.key} style={{display:'flex',alignItems:'center',flex:1}}>
                <div style={{flex:1}}>
                  <div style={{height:4,background:m.color,borderRadius:2}}/>
                  <div style={{fontSize:9,color:m.color,marginTop:4,fontWeight:700}}>{m.label.split(' ').slice(1).join(' ')}</div>
                  <div style={{fontSize:9,color:'#475569'}}>{form[m.key]}</div>
                </div>
                {i<arr.length-1&&<div style={{width:8,height:4,background:'#334155'}}/>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:10,marginTop:16}}>
        <Btn onClick={()=>onSave(form)} color="#10B981">Save Timeline</Btn>
        <Btn onClick={onClose} color="#475569" outline>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard({stats, requests}) {
  if (!stats) return <div style={{color:'#64748B',padding:40,textAlign:'center'}}>Loading…</div>;

  const KCard=({label,val,color,icon})=>(
    <div style={{...CARD,borderLeft:'3px solid '+color,flex:'1 1 120px',minWidth:110}}>
      <div style={{fontSize:20}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:800,color,margin:'4px 0 2px'}}>{val}</div>
      <div style={{fontSize:11,color:'#64748B'}}>{label}</div>
    </div>
  );

  const pending = requests.filter(r=>r.status?.startsWith('Pending')).length;
  const approved= requests.filter(r=>r.status==='Approved').length;
  const inDev   = requests.filter(r=>['Timeline Set','In Development','Testing','UAT'].includes(r.status)).length;
  const completed=requests.filter(r=>r.status==='Completed').length;
  const rejected =requests.filter(r=>r.status==='Rejected').length;

  const byCountry=ALL_COUNTRIES.map(c=>({c,n:requests.filter(r=>r.country===c).length})).filter(x=>x.n>0);
  const byStatus =['Pending Continent Manager','Pending Country Manager','Pending SDO Manager','Pending HOD','Pending VP'].map(s=>({s:s.replace('Pending ',''),n:requests.filter(r=>r.status===s).length}));
  const byCat    =Object.keys(CATS).map(c=>({c,n:requests.filter(r=>r.category===c).length}));
  const byPri    =PRIORITIES.map(p=>({p,n:requests.filter(r=>r.priority===p).length,col:PRI_C[p]}));
  const devPipeline=['Timeline Set','In Development','Testing','UAT','Pending Go Live','Go Live','Completed'].map(s=>({s,n:requests.filter(r=>r.status===s).length}));

  return (
    <div>
      <div style={{fontSize:20,fontWeight:800,color:'#E2E8F0',marginBottom:22}}>📊 Dashboard</div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
        <KCard label="Total"       val={requests.length} color="#0EA5E9" icon="📁"/>
        <KCard label="Pending"     val={pending}         color="#FBBF24" icon="⏳"/>
        <KCard label="Approved"    val={approved}        color="#34D399" icon="✅"/>
        <KCard label="In Dev/Test" val={inDev}           color="#38BDF8" icon="🔨"/>
        <KCard label="Completed"   val={completed}       color="#4ADE80" icon="🎉"/>
        <KCard label="Rejected"    val={rejected}        color="#F87171" icon="❌"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:16}}>
        {/* By Category bar */}
        <div style={CARD}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:14}}>By Category</div>
          {byCat.map(({c,n})=>(
            <div key={c} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:12,color:'#CBD5E1'}}>{CAT_I[c]} {c}</span>
                <span style={{fontSize:12,fontWeight:700,color:CAT_C[c]}}>{n}</span>
              </div>
              <div style={{height:5,background:'#0F172A',borderRadius:3}}>
                <div style={{height:5,background:CAT_C[c],borderRadius:3,width:requests.length?(n/requests.length*100)+'%':'0%',transition:'width .4s'}}/>
              </div>
            </div>
          ))}
        </div>

        {/* Pending by level */}
        <div style={CARD}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:14}}>⏳ Pending by Level</div>
          {byStatus.map(({s,n})=>(
            <div key={s} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'6px 10px',background:'#0F172A',borderRadius:6}}>
              <span style={{fontSize:11,color:'#94A3B8'}}>{s}</span>
              <span style={{fontSize:13,fontWeight:800,color:n>0?'#FBBF24':'#334155'}}>{n}</span>
            </div>
          ))}
        </div>

        {/* By Priority */}
        <div style={CARD}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:14}}>By Priority</div>
          <div style={{display:'flex',gap:8,alignItems:'flex-end',height:100}}>
            {byPri.map(({p,n,col})=>{
              const max=Math.max(...byPri.map(x=>x.n),1);
              return <div key={p} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:12,fontWeight:800,color:col}}>{n}</div>
                <div style={{width:'100%',height:Math.max(n/max*60,n>0?4:0),background:col,borderRadius:'4px 4px 0 0',transition:'height .4s'}}/>
                <div style={{fontSize:9,color:'#64748B'}}>{p.slice(0,4)}</div>
              </div>;
            })}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Dev Pipeline */}
        <div style={CARD}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:14}}>🔨 Development Pipeline</div>
          {devPipeline.map(({s,n})=>(
            <div key={s} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'6px 10px',background:'#0F172A',borderRadius:6,border:'1px solid '+(STA_C[s]||'#334155')+'30'}}>
              <span style={{fontSize:11,color:'#94A3B8'}}>{s}</span>
              <span style={{fontSize:13,fontWeight:800,color:STA_C[s]||'#334155'}}>{n}</span>
            </div>
          ))}
        </div>

        {/* By Country */}
        <div style={CARD}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:14}}>🌍🌏 By Country</div>
          {['EU','SEA'].map(cont=>(
            <div key={cont} style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:'#475569',marginBottom:6}}>{cont==='EU'?'🌍 EUROPE':'🌏 SEA'}</div>
              {CONTINENTS[cont].map(c=>{
                const n=requests.filter(r=>r.country===c).length;
                return <div key={c} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5,paddingBottom:5,borderBottom:'1px solid #0F172A'}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:10,fontFamily:'monospace',color:'#475569',background:'#0F172A',padding:'1px 5px',borderRadius:4}}>{WAREHOUSE_MAP[c]}</span>
                    <span style={{fontSize:11,color:'#94A3B8'}}>{c}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:n>0?'#0EA5E9':'#334155'}}>{n}</span>
                </div>;
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Recent audit */}
      {(stats.recentAudit||[]).length>0&&(
        <div style={{...CARD,marginTop:16}}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:14}}>🕵️ Recent Activity</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:8}}>
            {stats.recentAudit.slice(0,6).map((a,i)=>(
              <div key={i} style={{background:'#0F172A',borderRadius:8,padding:'8px 12px',border:'1px solid #1E293B'}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:2}}>
                  <span style={{fontSize:10,fontWeight:700,color:a.action?.includes('Approved')?'#34D399':a.action==='Rejected'?'#F87171':'#60A5FA'}}>{a.action}</span>
                  <span style={{fontSize:10,color:'#475569'}}>#{a.request_id}</span>
                </div>
                <div style={{fontSize:10,color:'#475569'}}>{a.performed_by} · {new Date(a.created_at).toLocaleDateString('en-MY')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── REQUEST FORM ───────────────────────────────────────────────────────────────
const BLANK={title:'',mainCategory:'Application',subCategory:'New Internal App',department:DEPARTMENTS[0],country:'',warehouse:'',priority:'Medium',riskLevel:'Low',businessProblem:'',currentProcess:'',proposedSolution:'',expectedBenefit:'',kpiImpact:'',estimatedUsers:1,estimatedDays:5,integrationRequired:false,wmsImpacted:false,apiRequired:false,downtimeRisk:false,rollbackRequired:false,status:'Pending Continent Manager'};

function RequestForm({initial,isNew,onSave,onClose,isAdmin}){
  const [form,setForm]=useState({...BLANK,...initial});
  const [saving,setSaving]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  function handleCountry(country){
    set('country',country);
    set('warehouse',WAREHOUSE_MAP[country]||'');
  }

  const flow=getFlow(form.priority);
  const skipVP=form.priority==='Low';

  async function save(){
    if(!form.title?.trim()){alert('Title is required');return;}
    if(!form.country){alert('Country is required');return;}
    setSaving(true);
    try{await onSave(form,isNew);}finally{setSaving(false);}
  }

  return(
    <div>
      {/* Flow indicator */}
      <div style={{background:'#0F172A',borderRadius:8,padding:'10px 14px',marginBottom:16,border:'1px solid #334155'}}>
        <div style={{fontSize:10,fontWeight:700,color:'#64748B',marginBottom:6}}>APPROVAL FLOW {skipVP?'(Low — VP skipped)':''}</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          {['Continent Mgr','Country Mgr','SDO Mgr','HOD',...(skipVP?[]:['VP']),'✅ Approved'].map((s,i,arr)=>(
            <div key={s} style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:4,background:s==='✅ Approved'?'#34D39920':'#1E293B',color:s==='✅ Approved'?'#34D399':'#64748B',border:'1px solid #334155'}}>{s}</span>
              {i<arr.length-1&&<span style={{color:'#334155',fontSize:10}}>→</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'#475569',borderBottom:'1px solid #334155',paddingBottom:6,marginBottom:12}}>REQUEST INFO</div>
          <SI label="Request Title *" value={form.title} onChange={v=>set('title',v)}/>
          <SS label="Main Category" value={form.mainCategory} onChange={v=>{set('mainCategory',v);set('subCategory',CATS[v][0]);}} options={Object.keys(CATS)}/>
          <SS label="Sub-Category" value={form.subCategory} onChange={v=>set('subCategory',v)} options={CATS[form.mainCategory]||[]}/>
          <SS label="Department" value={form.department} onChange={v=>set('department',v)} options={DEPARTMENTS}/>
          <CountrySelect value={form.country} onChange={handleCountry}/>
          <Fld label="Warehouse (auto-filled)">
            <input value={form.warehouse} readOnly style={{...INP,background:'#0A1020',color:'#475569',cursor:'default'}} placeholder="Select country first"/>
          </Fld>
          <SS label="Priority" value={form.priority} onChange={v=>set('priority',v)} options={PRIORITIES}/>
          <SS label="Risk Level" value={form.riskLevel} onChange={v=>set('riskLevel',v)} options={RISKS}/>
          <SI label="Est. Users" value={form.estimatedUsers} onChange={v=>set('estimatedUsers',v)} type="number"/>
          <SI label="Est. Dev Days" value={form.estimatedDays} onChange={v=>set('estimatedDays',v)} type="number"/>
          {isAdmin&&!isNew&&<SS label="⚡ Admin: Status Override" value={form.status||'Pending Continent Manager'} onChange={v=>set('status',v)} options={ALL_STATUSES}/>}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'#475569',borderBottom:'1px solid #334155',paddingBottom:6,marginBottom:12}}>BUSINESS CASE</div>
          <ST label="Business Problem *" value={form.businessProblem} onChange={v=>set('businessProblem',v)}/>
          <ST label="Current Process" value={form.currentProcess} onChange={v=>set('currentProcess',v)}/>
          <ST label="Proposed Solution *" value={form.proposedSolution} onChange={v=>set('proposedSolution',v)}/>
          <ST label="Expected Benefit" value={form.expectedBenefit} onChange={v=>set('expectedBenefit',v)}/>
          <ST label="KPI Impact" value={form.kpiImpact} onChange={v=>set('kpiImpact',v)}/>
          <div style={{fontSize:11,fontWeight:700,color:'#475569',borderBottom:'1px solid #334155',paddingBottom:6,marginBottom:10}}>TECHNICAL FLAGS</div>
          <SW label="Integration Required?" value={form.integrationRequired} onChange={v=>set('integrationRequired',v)}/>
          <SW label="WMS Impacted?" value={form.wmsImpacted} onChange={v=>set('wmsImpacted',v)}/>
          <SW label="API Required?" value={form.apiRequired} onChange={v=>set('apiRequired',v)}/>
          <SW label="Downtime Risk?" value={form.downtimeRisk} onChange={v=>set('downtimeRisk',v)}/>
          <SW label="Rollback Required?" value={form.rollbackRequired} onChange={v=>set('rollbackRequired',v)}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginTop:20,borderTop:'1px solid #334155',paddingTop:16}}>
        <Btn onClick={save} disabled={saving}>{saving?'Saving…':isNew?'Submit Request →':'Save Changes'}</Btn>
        <Btn onClick={onClose} color="#475569" outline>Cancel</Btn>
      </div>
    </div>
  );
}

// ── IMPORT MODAL ───────────────────────────────────────────────────────────────
function ImportModal({onClose,onImport,user}){
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState([]);
  const [importing,setImporting]=useState(false);
  const [done,setDone]=useState(0);
  const fileRef=useRef();

  function handleFile(f){
    setFile(f);
    const reader=new FileReader();
    reader.onload=e=>{setPreview(parseCSV(e.target.result).slice(0,5));};
    reader.readAsText(f);
  }

  async function handleImport(){
    if(!file)return;
    setImporting(true);
    const reader=new FileReader();
    reader.onload=async e=>{
      const rows=parseCSV(e.target.result);
      let count=0;
      for(const row of rows){
        try{
          const country=row.country||'Malaysia';
          await api.createRequest({
            title:row.title||'Imported',
            mainCategory:row.category||row.main_category||'Application',
            subCategory:row.sub_category||'New Internal App',
            department:row.department||DEPARTMENTS[0],
            country,
            warehouse:WAREHOUSE_MAP[country]||row.warehouse||'',
            priority:row.priority||'Medium',
            riskLevel:row.risk_level||'Low',
            businessProblem:row.business_problem||'',
            currentProcess:row.current_process||'',
            proposedSolution:row.proposed_solution||'',
            expectedBenefit:row.expected_benefit||'',
            kpiImpact:row.kpi_impact||'',
            estimatedUsers:parseInt(row.estimated_users)||1,
            estimatedDays:parseInt(row.estimated_days)||5,
            integrationRequired:row.integration_req==='Yes',
            wmsImpacted:row.wms_impacted==='Yes',
            apiRequired:row.api_required==='Yes',
            downtimeRisk:row.downtime_risk==='Yes',
            rollbackRequired:row.rollback_req==='Yes',
            requestor_id:user.id,
            requestor_name:user.name,
            status:'Pending Continent Manager',
            vp_required:row.priority!=='Low',
            submitted_date:new Date().toISOString().split('T')[0],
          });
          count++;
        }catch(err){console.warn('Row failed:',err);}
      }
      setDone(count);setImporting(false);onImport(count);
    };
    reader.readAsText(f);
  }

  return(
    <Modal title="📥 Import Requests from CSV" onClose={onClose}>
      <div style={{background:'#0F172A',borderRadius:8,padding:'12px 14px',marginBottom:14,border:'1px solid #334155',fontSize:11,color:'#94A3B8'}}>
        Required columns: <span style={{color:'#A3E635',fontFamily:'monospace'}}>title, category, department, country, priority</span><br/>
        💡 Export first to get the exact format
      </div>
      <div onClick={()=>fileRef.current?.click()} style={{border:'2px dashed #334155',borderRadius:10,padding:'32px',textAlign:'center',cursor:'pointer',marginBottom:14,background:'#0F172A'}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
        <div style={{fontSize:32,marginBottom:8}}>📂</div>
        <div style={{fontSize:13,color:'#CBD5E1',fontWeight:600}}>{file?file.name:'Click or drag & drop CSV file'}</div>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
      </div>
      {preview.length>0&&<div style={{background:'#0F172A',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
        {preview.map((r,i)=><div key={i} style={{fontSize:11,color:'#94A3B8',marginBottom:3,fontFamily:'monospace'}}>{i+1}. {r.title} — {r.country} — {r.priority}</div>)}
      </div>}
      {done>0&&<div style={{background:'#064E3B',border:'1px solid #34D399',borderRadius:8,padding:'10px',marginBottom:12,color:'#6EE7B7',fontSize:13,fontWeight:700}}>✅ Imported {done} requests!</div>}
      <div style={{display:'flex',gap:10}}>
        <Btn onClick={handleImport} disabled={!file||importing} color="#10B981">{importing?'Importing…':'Import'}</Btn>
        <Btn onClick={onClose} color="#475569" outline>Close</Btn>
      </div>
    </Modal>
  );
}

// ── REQUESTS ───────────────────────────────────────────────────────────────────
function Requests({user,requests,setRequests,showToast}){
  const [search,setSearch]=useState('');
  const [fCat,setFCat]=useState('All');
  const [fSta,setFSta]=useState('All');
  const [fCont,setFCont]=useState('All');
  const [showNew,setShowNew]=useState(false);
  const [editing,setEditing]=useState(null);
  const [viewing,setViewing]=useState(null);
  const [delId,setDelId]=useState(null);
  const [actReq,setActReq]=useState(null);
  const [actType,setActType]=useState('');
  const [actNote,setActNote]=useState('');
  const [showImport,setShowImport]=useState(false);
  const [showTimeline,setShowTimeline]=useState(null);

  const isAdmin   = user.role==='Admin';
  const isITTeam  = user.role==='IT Team'||isAdmin;
  const canApprove= ['Continent Manager','Country Manager','SDO Manager','HOD','VP','Admin'].includes(user.role);

  const filtered=requests.filter(r=>{
    const contMatch=fCont==='All'||(fCont==='EU'&&CONTINENTS.EU.includes(r.country))||(fCont==='SEA'&&CONTINENTS.SEA.includes(r.country));
    return contMatch&&(fCat==='All'||r.category===fCat)&&(fSta==='All'||r.status===fSta)&&(search===''||r.title?.toLowerCase().includes(search.toLowerCase())||String(r.id).includes(search)||r.country?.toLowerCase().includes(search.toLowerCase()));
  });

  async function handleSave(form,isNew){
    try{
      const payload={
        title:form.title,category:form.mainCategory,sub_category:form.subCategory,
        department:form.department,country:form.country,warehouse:form.warehouse,
        priority:form.priority,risk_level:form.riskLevel,
        vp_required:form.priority!=='Low',
        estimated_days:form.estimatedDays,estimated_users:form.estimatedUsers,
        integration_req:form.integrationRequired,wms_impacted:form.wmsImpacted,
        api_required:form.apiRequired,downtime_risk:form.downtimeRisk,rollback_req:form.rollbackRequired,
        business_problem:form.businessProblem,current_process:form.currentProcess,
        proposed_solution:form.proposedSolution,expected_benefit:form.expectedBenefit,kpi_impact:form.kpiImpact,
      };
      if(isNew){
        payload.requestor_id=user.id;payload.requestor_name=user.name;
        payload.status='Pending Continent Manager';payload.submitted_date=new Date().toISOString().split('T')[0];
        const d=await api.createRequest(payload);
        setRequests(r=>[d,...r]);
        await api.addAudit(d.id,'Submitted',user.name,'Request submitted for approval');
        showToast('Request submitted ✅','green');
      }else{
        if(isAdmin)payload.status=form.status;
        const d=await api.updateRequest(editing.id,payload);
        setRequests(r=>r.map(x=>x.id===editing.id?d:x));
        await api.addAudit(editing.id,'Edited',user.name,'Request updated');
        showToast('Updated ✅','green');
      }
      setEditing(null);setShowNew(false);
    }catch(e){showToast(e.message,'red');}
  }

  async function handleAction(){
    try{
      const next=nextStatus(actReq.status,actReq.priority);
      const lvl=LEVEL_MAP[actReq.status];
      if(actType==='approve'){
        await api.updateRequest(actReq.id,{status:next});
        await api.addAudit(actReq.id,'Approved L'+(lvl?.level||''),user.name,actNote||'Approved');
        setRequests(r=>r.map(x=>x.id===actReq.id?{...x,status:next}:x));
        showToast('Approved → '+next,'green');
      }else{
        await api.updateRequest(actReq.id,{status:'Rejected'});
        await api.addAudit(actReq.id,'Rejected',user.name,actNote||'No reason');
        setRequests(r=>r.map(x=>x.id===actReq.id?{...x,status:'Rejected'}:x));
        showToast('Rejected','red');
      }
    }catch(e){showToast(e.message,'red');}
    finally{setActReq(null);setActNote('');}
  }

  async function handleTimeline(form){
    try{
      const d=await api.updateRequest(showTimeline.id,{...form,status:'Timeline Set'});
      setRequests(r=>r.map(x=>x.id===showTimeline.id?d:x));
      await api.addAudit(showTimeline.id,'Timeline Set',user.name,`Dev: ${form.dev_start} | GoLive: ${form.go_live_date}`);
      showToast('Timeline set ✅','green');
      setShowTimeline(null);
    }catch(e){showToast(e.message,'red');}
  }

  async function handleOverride(reqId,status){
    try{
      await api.updateRequest(reqId,{status});
      await api.addAudit(reqId,'Admin Override',user.name,'Status: '+status);
      setRequests(r=>r.map(x=>x.id===reqId?{...x,status}:x));
      setViewing(v=>v?{...v,status}:v);
      showToast('Status updated','green');
    }catch(e){showToast(e.message,'red');}
  }

  function toForm(r){return{...r,mainCategory:r.category,subCategory:r.sub_category,estimatedDays:r.estimated_days,estimatedUsers:r.estimated_users,riskLevel:r.risk_level,integrationRequired:r.integration_req,wmsImpacted:r.wms_impacted,apiRequired:r.api_required,downtimeRisk:r.downtime_risk,rollbackRequired:r.rollback_req,businessProblem:r.business_problem,currentProcess:r.current_process,proposedSolution:r.proposed_solution,expectedBenefit:r.expected_benefit,kpiImpact:r.kpi_impact};}

  async function handleImportDone(count){
    const fresh=await api.getRequests();setRequests(fresh||[]);
    showToast(`Imported ${count} requests ✅`,'green');
    setTimeout(()=>setShowImport(false),2000);
  }

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div style={{fontSize:20,fontWeight:800,color:'#E2E8F0'}}>📋 Requests</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>exportToCSV(filtered)} style={{padding:'8px 14px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,border:'1.5px solid #10B981',background:'transparent',color:'#10B981',fontFamily:'inherit'}}>📤 Export CSV ({filtered.length})</button>
          {isAdmin&&<button onClick={()=>setShowImport(true)} style={{padding:'8px 14px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,border:'1.5px solid #F59E0B',background:'transparent',color:'#F59E0B',fontFamily:'inherit'}}>📥 Import</button>}
          <Btn onClick={()=>setShowNew(true)}>+ New Request</Btn>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search title, country, ID…" style={{...INP,flex:'1 1 180px',width:'auto'}}/>
        <select value={fCont} onChange={e=>setFCont(e.target.value)} style={{...INP,width:'auto'}}>
          <option value="All">All Regions</option>
          <option value="EU">🌍 Europe</option>
          <option value="SEA">🌏 SEA</option>
        </select>
        <select value={fCat} onChange={e=>setFCat(e.target.value)} style={{...INP,width:'auto'}}>
          <option value="All">All Categories</option>{Object.keys(CATS).map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={fSta} onChange={e=>setFSta(e.target.value)} style={{...INP,width:'auto'}}>
          <option value="All">All Statuses</option>{ALL_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{fontSize:11,color:'#475569',marginBottom:10}}>{filtered.length} requests</div>

      {/* Table */}
      <div style={{background:'#1E293B',borderRadius:12,border:'1px solid #334155',overflow:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'55px 1fr 90px 80px 80px 175px 200px',background:'#0F172A',padding:'10px 16px',gap:8,minWidth:800}}>
          {['ID','Title','Category','Priority','Region','Status','Actions'].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:.8}}>{h}</div>)}
        </div>
        {filtered.map((r,i)=>{
          const cont=getContinent(r.country);
          return <div key={r.id} style={{display:'grid',gridTemplateColumns:'55px 1fr 90px 80px 80px 175px 200px',padding:'10px 16px',gap:8,alignItems:'center',background:i%2===0?'#1E293B':'#192132',borderTop:'1px solid #0F172A',minWidth:800}}>
            <div style={{fontSize:11,fontWeight:700,color:'#60A5FA'}}>#{r.id}</div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:'#CBD5E1'}}>{r.title}</div>
              <div style={{fontSize:10,color:'#475569'}}>{r.sub_category} · <span style={{fontFamily:'monospace',background:'#0F172A',padding:'0 4px',borderRadius:3}}>{r.warehouse}</span> {r.country}</div>
            </div>
            <Tag label={r.category} color={CAT_C[r.category]||'#94A3B8'}/>
            <Tag label={r.priority} color={PRI_C[r.priority]||'#94A3B8'}/>
            <span style={{fontSize:10,fontWeight:700,color:cont==='EU'?'#60A5FA':'#34D399',background:(cont==='EU'?'#60A5FA':'#34D399')+'20',padding:'2px 6px',borderRadius:10,border:'1px solid '+(cont==='EU'?'#60A5FA':'#34D399')+'40'}}>{cont==='EU'?'🌍 EU':'🌏 SEA'}</span>
            <Sta s={r.status}/>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              <button onClick={()=>setViewing(r)} style={{padding:'3px 8px',borderRadius:5,background:'#0EA5E920',border:'1px solid #0EA5E940',color:'#0EA5E9',fontSize:10,cursor:'pointer',fontWeight:600}}>View</button>
              {canApprove&&r.status.startsWith('Pending')&&<>
                <button onClick={()=>{setActReq(r);setActType('approve');}} style={{padding:'3px 8px',borderRadius:5,background:'#34D39920',border:'1px solid #34D39940',color:'#34D399',fontSize:10,cursor:'pointer',fontWeight:600}}>✓ Approve</button>
                <button onClick={()=>{setActReq(r);setActType('reject');}} style={{padding:'3px 8px',borderRadius:5,background:'#EF444420',border:'1px solid #EF444440',color:'#EF4444',fontSize:10,cursor:'pointer',fontWeight:600}}>✕</button>
              </>}
              {isITTeam&&r.status==='Approved'&&<button onClick={()=>setShowTimeline(r)} style={{padding:'3px 8px',borderRadius:5,background:'#38BDF820',border:'1px solid #38BDF840',color:'#38BDF8',fontSize:10,cursor:'pointer',fontWeight:600}}>📅 Set Timeline</button>}
              {isAdmin&&<button onClick={()=>setEditing(toForm(r))} style={{padding:'3px 8px',borderRadius:5,background:'#F59E0B20',border:'1px solid #F59E0B40',color:'#F59E0B',fontSize:10,cursor:'pointer',fontWeight:600}}>Edit</button>}
              {isAdmin&&<button onClick={()=>setDelId(r.id)} style={{padding:'3px 8px',borderRadius:5,background:'#EF444415',border:'1px solid #EF444430',color:'#EF4444',fontSize:10,cursor:'pointer',fontWeight:600}}>Del</button>}
            </div>
          </div>;
        })}
        {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'#475569'}}>No requests found.</div>}
      </div>

      {/* MODALS */}
      {showNew&&<Modal title="✍️ New Request" onClose={()=>setShowNew(false)} wide><RequestForm isNew initial={BLANK} onSave={handleSave} onClose={()=>setShowNew(false)} isAdmin={isAdmin}/></Modal>}
      {editing&&<Modal title={'✏️ Edit #'+editing.id} onClose={()=>setEditing(null)} wide><RequestForm initial={editing} onSave={handleSave} onClose={()=>setEditing(null)} isAdmin={isAdmin}/></Modal>}
      {showImport&&<ImportModal onClose={()=>setShowImport(false)} onImport={handleImportDone} user={user}/>}
      {showTimeline&&<TimelineModal request={showTimeline} onSave={handleTimeline} onClose={()=>setShowTimeline(null)}/>}

      {viewing&&<Modal title={'#'+viewing.id+' — '+viewing.title} onClose={()=>setViewing(null)} wide>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
          <Tag label={viewing.category} color={CAT_C[viewing.category]||'#94A3B8'}/>
          <Sta s={viewing.status}/>
          <Tag label={viewing.priority} color={PRI_C[viewing.priority]||'#94A3B8'}/>
          <Tag label={getContinent(viewing.country)==='EU'?'🌍 EU':'🌏 SEA'} color={getContinent(viewing.country)==='EU'?'#60A5FA':'#34D399'}/>
          <Tag label={viewing.warehouse||'—'} color="#475569"/>
        </div>

        {/* Approval flow */}
        <div style={CARD}>
          <div style={{fontSize:11,fontWeight:700,color:'#64748B',marginBottom:10}}>APPROVAL FLOW</div>
          <ApprovalFlowBar status={viewing.status} priority={viewing.priority} country={viewing.country}/>
        </div>

        {/* Dev Timeline (if set) */}
        {(viewing.dev_start||viewing.go_live_date)&&<div style={{...CARD,marginTop:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#64748B',marginBottom:10}}>📅 DEVELOPMENT TIMELINE</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[['🔨 Dev Start',viewing.dev_start,'#0EA5E9'],['🧪 Testing',viewing.testing_start,'#818CF8'],['✅ UAT',viewing.uat_start,'#C084FC'],['🚀 Go Live',viewing.go_live_date,'#4ADE80']].map(([l,d,c])=>(
              <div key={l} style={{background:'#0F172A',borderRadius:8,padding:'10px',border:'1px solid '+c+'30'}}>
                <div style={{fontSize:10,color:c,fontWeight:700,marginBottom:4}}>{l}</div>
                <div style={{fontSize:12,color:d?'#CBD5E1':'#334155',fontWeight:600}}>{d||'Not set'}</div>
              </div>
            ))}
          </div>
          {viewing.dev_notes&&<div style={{marginTop:10,fontSize:12,color:'#64748B'}}>{viewing.dev_notes}</div>}
        </div>}

        {isAdmin&&<div style={{background:'#0F172A',borderRadius:8,padding:'12px 14px',marginTop:12,border:'1px solid #F59E0B30'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#F59E0B',marginBottom:8}}>⚡ Admin: Override Status</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ALL_STATUSES.map(st=><button key={st} onClick={()=>handleOverride(viewing.id,st)} style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:700,background:viewing.status===st?(STA_C[st]||'#64748B')+'33':'transparent',border:'1px solid '+(STA_C[st]||'#64748B')+'55',color:STA_C[st]||'#64748B'}}>{st}</button>)}
          </div>
        </div>}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}}>
          <div style={CARD}>
            <div style={{fontSize:11,fontWeight:700,color:'#64748B',marginBottom:10}}>DETAILS</div>
            {[['Requestor',viewing.requestor_name],['Submitted',viewing.submitted_date],['Department',viewing.department],['Country',viewing.country],['Warehouse',viewing.warehouse],['Est. Users',viewing.estimated_users],['Est. Days',viewing.estimated_days+'d']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid #0F172A',paddingBottom:5,marginBottom:5}}>
                <span style={{fontSize:11,color:'#64748B'}}>{k}</span><span style={{fontSize:11,color:'#CBD5E1',fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={CARD}>
            <div style={{fontSize:11,fontWeight:700,color:'#64748B',marginBottom:10}}>FLAGS</div>
            {[['Integration',viewing.integration_req],['WMS Impacted',viewing.wms_impacted],['API Required',viewing.api_required],['Downtime Risk',viewing.downtime_risk],['VP Required',viewing.vp_required]].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid #0F172A',paddingBottom:5,marginBottom:5}}>
                <span style={{fontSize:11,color:'#64748B'}}>{k}</span><span style={{fontSize:11,fontWeight:700,color:v?'#F87171':'#34D399'}}>{v?'⚠ YES':'✓ NO'}</span>
              </div>
            ))}
          </div>
        </div>
        {[['Business Problem',viewing.business_problem],['Proposed Solution',viewing.proposed_solution],['Expected Benefit',viewing.expected_benefit]].filter(([,v])=>v).map(([k,v])=>(
          <div key={k} style={{...CARD,marginTop:10}}><div style={{fontSize:11,fontWeight:700,color:'#64748B',marginBottom:6}}>{k.toUpperCase()}</div><div style={{fontSize:12,color:'#94A3B8',lineHeight:1.6}}>{v}</div></div>
        ))}
      </Modal>}

      {delId&&<Modal title="⚠️ Delete" onClose={()=>setDelId(null)}>
        <p style={{color:'#94A3B8',fontSize:13,marginBottom:20}}>Delete request <strong style={{color:'#F87171'}}>#{delId}</strong>?</p>
        <div style={{display:'flex',gap:10}}><Btn onClick={async()=>{try{await api.deleteRequest(delId);setRequests(r=>r.filter(x=>x.id!==delId));showToast('Deleted','green');}catch(e){showToast(e.message,'red');}finally{setDelId(null);}}} color="#EF4444">Delete</Btn><Btn onClick={()=>setDelId(null)} color="#475569" outline>Cancel</Btn></div>
      </Modal>}

      {actReq&&<Modal title={(actType==='approve'?'✅ Approve':'❌ Reject')+' — #'+actReq.id} onClose={()=>{setActReq(null);setActNote('');}}>
        <p style={{color:'#CBD5E1',fontSize:13,fontWeight:600,marginBottom:4}}>{actReq.title}</p>
        <p style={{color:'#475569',fontSize:12,marginBottom:4}}>{actReq.country} · {actReq.priority}</p>
        {actType==='approve'&&<div style={{background:'#0F172A',borderRadius:8,padding:'8px 12px',marginBottom:12,border:'1px solid #34D39940'}}>
          <div style={{fontSize:11,color:'#34D399',fontWeight:700}}>Next → {nextStatus(actReq.status,actReq.priority)}</div>
        </div>}
        <ST label={actType==='approve'?'Comment (optional)':'Reason for rejection *'} value={actNote} onChange={setActNote}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <Btn onClick={handleAction} color={actType==='approve'?'#34D399':'#EF4444'}>{actType==='approve'?'Confirm Approve':'Confirm Reject'}</Btn>
          <Btn onClick={()=>{setActReq(null);setActNote('');}} color="#475569" outline>Cancel</Btn>
        </div>
      </Modal>}
    </div>
  );
}

// ── USERS ──────────────────────────────────────────────────────────────────────
function Users({users,setUsers,showToast}){
  const [editing,setEditing]=useState(null);
  const [search,setSearch]=useState('');
  const ALL_ROLES=['Requestor','Continent Manager','Country Manager','SDO Manager','HOD','VP','IT Team','Admin'];
  const filtered=users.filter(u=>search===''||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase()));
  async function save(form){
    try{
      const d=await api.updateUserRole(form.id,{role:form.role,department:form.department,country:form.country,warehouse:form.warehouse,active:form.active});
      setUsers(u=>u.map(x=>x.id===form.id?{...x,...d}:x));
      showToast('User updated ✅','green');setEditing(null);
    }catch(e){showToast(e.message,'red');}
  }
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:'#E2E8F0',marginBottom:20}}>👥 User Management</div>
      <div style={{background:'#1E3A5F22',border:'1px solid #1E3A5F',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:12,color:'#93C5FD'}}>
        💡 Team signs in with company Google → appear here as Requestor → you assign their role
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{...INP,maxWidth:360,marginBottom:16}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
        {filtered.map(u=>(
          <div key={u.id} style={{...CARD,borderLeft:'3px solid '+(ROL_C[u.role]||'#475569'),opacity:u.active?1:.55}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div><div style={{fontSize:14,fontWeight:800,color:'#E2E8F0'}}>{u.name||'—'}</div><div style={{fontSize:11,color:'#64748B'}}>{u.email}</div></div>
              <Tag label={u.role||'Requestor'} color={ROL_C[u.role]||'#94A3B8'}/>
            </div>
            <div style={{fontSize:11,color:'#64748B',marginBottom:12}}>{u.department||'—'} · {u.country||'—'}</div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:12,background:u.active?'#34D39920':'#EF444420',color:u.active?'#34D399':'#EF4444',fontWeight:700}}>{u.active?'Active':'Inactive'}</span>
              <button onClick={()=>setEditing({...u})} style={{padding:'3px 10px',borderRadius:5,background:'#F59E0B20',border:'1px solid #F59E0B40',color:'#F59E0B',fontSize:11,cursor:'pointer',fontWeight:600}}>Edit Role</button>
            </div>
          </div>
        ))}
      </div>
      {editing&&<Modal title={'Edit — '+editing.name} onClose={()=>setEditing(null)}>
        <div style={{fontSize:12,color:'#64748B',marginBottom:14}}>{editing.email}</div>
        <SS label="Role" value={editing.role||'Requestor'} onChange={v=>setEditing(e=>({...e,role:v}))} options={ALL_ROLES}/>
        <SS label="Department" value={editing.department||DEPARTMENTS[0]} onChange={v=>setEditing(e=>({...e,department:v}))} options={DEPARTMENTS}/>
        <CountrySelect value={editing.country||''} onChange={v=>setEditing(e=>({...e,country:v,warehouse:WAREHOUSE_MAP[v]||''}))}/>
        <SW label="Active?" value={editing.active??true} onChange={v=>setEditing(e=>({...e,active:v}))}/>
        <div style={{display:'flex',gap:10,marginTop:16}}><Btn onClick={()=>save(editing)} color="#10B981">Save</Btn><Btn onClick={()=>setEditing(null)} color="#475569" outline>Cancel</Btn></div>
      </Modal>}
    </div>
  );
}

// ── AUDIT LOG ──────────────────────────────────────────────────────────────────
function AuditLog(){
  const [log,setLog]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{api.getAuditLog().then(d=>{setLog(d||[]);setLoading(false);}).catch(()=>setLoading(false));},[]);
  const AC={'Submitted':'#60A5FA','Approved L1':'#34D399','Approved L2':'#34D399','Approved L3':'#34D399','Approved L4':'#34D399','Approved L5':'#34D399',Edited:'#FBBF24',Deleted:'#F87171','Admin Override':'#A78BFA',Rejected:'#F87171','Timeline Set':'#38BDF8'};
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:'#E2E8F0',marginBottom:20}}>🕵️ Audit Log</div>
      {loading?<div style={{color:'#64748B',padding:40,textAlign:'center'}}>Loading…</div>:
      <div style={{background:'#1E293B',borderRadius:12,border:'1px solid #334155',overflow:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'155px 140px 70px 130px 1fr',background:'#0F172A',padding:'10px 16px',gap:8,minWidth:600}}>
          {['Timestamp','User','Req #','Action','Detail'].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:.8}}>{h}</div>)}
        </div>
        {log.map((a,i)=>(
          <div key={a.id} style={{display:'grid',gridTemplateColumns:'155px 140px 70px 130px 1fr',padding:'10px 16px',gap:8,alignItems:'center',background:i%2===0?'#1E293B':'#192132',borderTop:'1px solid #0F172A',minWidth:600}}>
            <div style={{fontSize:11,color:'#64748B'}}>{new Date(a.created_at).toLocaleString('en-MY')}</div>
            <div style={{fontSize:11,color:'#CBD5E1',fontWeight:600}}>{a.performed_by}</div>
            <div style={{fontSize:11,color:'#60A5FA'}}>#{a.request_id}</div>
            <span style={{fontSize:10,padding:'2px 8px',borderRadius:12,background:(AC[a.action]||'#94A3B8')+'20',color:AC[a.action]||'#94A3B8',fontWeight:700,whiteSpace:'nowrap'}}>{a.action}</span>
            <div style={{fontSize:11,color:'#64748B'}}>{a.detail}</div>
          </div>
        ))}
        {log.length===0&&<div style={{padding:32,textAlign:'center',color:'#475569'}}>No audit records yet.</div>}
      </div>}
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App(){
  const [session,setSession]=useState(undefined);
  const [profile,setProfile]=useState(null);
  const [requests,setRequests]=useState([]);
  const [users,setUsers]=useState([]);
  const [stats,setStats]=useState(null);
  const [tab,setTab]=useState('dashboard');
  const [toast,setToast]=useState(null);

  function showToast(msg,color='green'){setToast({msg,color});setTimeout(()=>setToast(null),3500);}

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session){setProfile(null);return;}
    api.getProfile(session.user.id)
      .then(setProfile)
      .catch(()=>setProfile({id:session.user.id,name:session.user.user_metadata?.full_name||session.user.email,email:session.user.email,role:'Requestor'}));
  },[session]);

  const loadData=useCallback(async()=>{
    if(!profile)return;
    try{
      const[reqs,dash]=await Promise.all([api.getRequests(),api.getDashboardStats()]);
      setRequests(reqs||[]);setStats(dash);
      if(profile.role==='Admin'){const us=await api.getUsers();setUsers(us||[]);}
    }catch(e){console.error(e);}
  },[profile]);

  useEffect(()=>{loadData();},[loadData]);

  if(session===undefined)return <div style={{minHeight:'100vh',background:'#070C14',display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontFamily:'inherit'}}><div style={{textAlign:'center'}}><div style={{fontSize:32,marginBottom:12}}>🏭</div>Loading…</div></div>;

  if(!session)return(
    <div style={{minHeight:'100vh',background:'#070C14',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif",position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(14,165,233,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.04) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}}/>
      <div style={{background:'#0F1A2A',borderRadius:20,border:'1px solid #1E3A5F',padding:'48px 44px',width:400,boxShadow:'0 32px 80px #00000070',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{width:60,height:60,borderRadius:16,background:'linear-gradient(135deg,#0EA5E9,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 16px',boxShadow:'0 8px 24px rgba(14,165,233,.3)'}}>🏭</div>
          <div style={{fontSize:22,fontWeight:800,color:'#F0F8FF'}}>WMS Approval System</div>
          <div style={{fontSize:12,color:'#475569',marginTop:6,lineHeight:1.5}}>Private access · Company accounts only<br/>Powered by Google Workspace</div>
        </div>
        <button onClick={async()=>{const{error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://system-matrix-approval.vercel.app'}});if(error)alert(error.message);}} style={{width:'100%',padding:'13px 20px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:14,background:'#fff',color:'#1F2937',border:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:12,boxShadow:'0 4px 16px #00000040',fontFamily:'inherit'}}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
          Continue with Google
        </button>
        <div style={{textAlign:'center',marginTop:20,fontSize:11,color:'#334155'}}>No self-registration · Authorised company emails only</div>
      </div>
    </div>
  );

  if(!profile)return <div style={{minHeight:'100vh',background:'#070C14',display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontFamily:'inherit'}}>Setting up your account…</div>;

  const isAdmin=profile.role==='Admin';
  const TABS=[
    {id:'dashboard',label:'Dashboard',icon:'📊'},
    {id:'requests', label:'Requests', icon:'📋'},
    {id:'users',    label:'Users',    icon:'👥',admin:true},
    {id:'audit',    label:'Audit Log',icon:'🕵️',admin:true},
  ];
  const myTabs=TABS.filter(t=>!t.admin||isAdmin);

  return(
    <div style={{minHeight:'100vh',background:'#070C14',fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif",color:'#E2E8F0',display:'flex',flexDirection:'column'}}>
      {toast&&<div style={{position:'fixed',top:70,right:20,zIndex:999,background:toast.color==='green'?'#064E3B':'#7F1D1D',border:'1px solid '+(toast.color==='green'?'#34D399':'#F87171'),color:toast.color==='green'?'#6EE7B7':'#FCA5A5',padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:700,boxShadow:'0 8px 24px #00000060'}}>{toast.msg}</div>}

      <div style={{background:'#0A0F1A',borderBottom:'1px solid #1E293B',padding:'0 24px',display:'flex',alignItems:'center',position:'sticky',top:0,zIndex:50,height:52}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginRight:32}}>
          <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#0EA5E9,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>🏭</div>
          <div><div style={{fontSize:13,fontWeight:800,color:'#E2E8F0',lineHeight:1}}>WMS Approval</div><div style={{fontSize:9,color:'#475569',letterSpacing:1.5}}>SPO · GCE · WSI · SDO</div></div>
        </div>
        <div style={{display:'flex',flex:1}}>
          {myTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'0 14px',height:52,background:'transparent',border:'none',borderBottom:'2px solid '+(tab===t.id?'#0EA5E9':'transparent'),color:tab===t.id?'#0EA5E9':'#64748B',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
              {t.icon} {t.label}
              {t.admin&&<span style={{fontSize:9,background:'#F59E0B22',color:'#F59E0B',padding:'1px 5px',borderRadius:4,fontWeight:700}}>ADMIN</span>}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#CBD5E1'}}>{profile.name}</div>
            <div style={{fontSize:9,fontWeight:700,color:ROL_C[profile.role]||'#64748B'}}>{profile.role}</div>
          </div>
          <button onClick={()=>supabase.auth.signOut()} style={{padding:'6px 12px',borderRadius:7,background:'transparent',border:'1px solid #334155',color:'#64748B',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Sign Out</button>
        </div>
      </div>

      {isAdmin&&<div style={{background:'linear-gradient(90deg,#0EA5E9,#8B5CF6)',padding:'5px 24px',fontSize:11,fontWeight:700,color:'#fff'}}>🔑 ADMIN MODE — Full access · Import · Export · Timeline · Override</div>}

      <div style={{flex:1,padding:'28px',maxWidth:1360,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
        {tab==='dashboard'&&<Dashboard stats={stats} requests={requests}/>}
        {tab==='requests'&&<Requests user={profile} requests={requests} setRequests={setRequests} showToast={showToast}/>}
        {tab==='users'&&isAdmin&&<Users users={users} setUsers={setUsers} showToast={showToast}/>}
        {tab==='audit'&&isAdmin&&<AuditLog/>}
      </div>

      <div style={{borderTop:'1px solid #1E293B',padding:'10px 24px',display:'flex',justifyContent:'space-between',fontSize:10,color:'#334155'}}>
        <span>WMS Approval System · {profile.role} · SPO-EU · SPO-SEA · GCE · WSI · SDO</span>
        <span>{requests.length} requests · {requests.filter(r=>r.status?.startsWith('Pending')).length} pending</span>
      </div>
    </div>
  );
}