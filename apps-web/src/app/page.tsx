'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agent = {
id: string
name: string | null
}

type Contact = {
id: string
full_name: string | null
phone: string | null
email: string | null
city: string | null
state: string | null
agent_id: string | null
}

type Lead = {
id: string
name: string | null
phone: string | null
email: string | null
source: string | null
score: number | null
status: string | null
assigned_agent: string | null
}

type Property = {
id: string
address1: string | null
city: string | null
state: string | null
status: string | null
contact_id: string | null
price: number | null
}

// ---------------- STATE ----------------

export default function HoardDashboard() {
const [status, setStatus] = useState('Booting Hoard...')
const [agents, setAgents] = useState<Agent[]>([])
const [contacts, setContacts] = useState<Contact[]>([])
const [leads, setLeads] = useState<Lead[]>([])
const [properties, setProperties] = useState<Property[]>([])

const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null)

// ---------------- LOAD ----------------

async function loadData() {
setStatus('Loading system data...')

const [a, c, l, p] = await Promise.all([
supabase.from('agents').select('*'),
supabase.from('contacts').select('*'),
supabase.from('leads').select('*'),
supabase.from('properties').select('*'),
])

if (a.error || c.error || l.error || p.error) {
setStatus('LOAD_ERROR')
return
}

setAgents(a.data || [])
setContacts(c.data || [])
setLeads(l.data || [])
setProperties(p.data || [])

setStatus('System Ready')
}

useEffect(() => {
loadData()
}, [])

// ---------------- HELPERS ----------------

function getAgentName(id: string | null) {
if (!id) return 'Unassigned'
return agents.find((a) => a.id === id)?.name || 'Unknown'
}

function getContactName(id: string | null) {
if (!id) return 'No contact'
return contacts.find((c) => c.id === id)?.full_name || 'Unknown'
}

function formatCurrency(n: number | null) {
return '$' + Number(n || 0).toLocaleString()
}

// ---------------- CONVERSION ----------------

async function convertLead(lead: Lead) {
setConvertingLeadId(lead.id)
setStatus('Converting lead...')

const res = await supabase.from('contacts').insert([
{
full_name: lead.name,
phone: lead.phone,
email: lead.email,
agent_id: lead.assigned_agent,
},
])

if (res.error) {
setStatus('CONVERSION_ERROR')
setConvertingLeadId(null)
return
}

await supabase
.from('leads')
.update({ status: 'converted' })
.eq('id', lead.id)

setConvertingLeadId(null)
setStatus('Lead converted')

loadData()
}

// ---------------- METRICS ----------------

const hotLeads = leads.filter((l) => (l.score || 0) >= 80)
const unassignedLeads = leads.filter((l) => !l.assigned_agent)
const activeDeals = properties.filter((p) => p.status === 'under_contract')

// ---------------- UI ----------------

return (
<main style={main}>
<h1>Hoard — Broker Command Center</h1>
<p>{status}</p>

{/* METRICS */}
<section style={section}>
<h2>Overview</h2>
<div style={grid4}>
<Card label="Contacts" value={contacts.length} />
<Card label="Leads" value={leads.length} />
<Card label="Active Deals" value={activeDeals.length} />
<Card label="Hot Leads" value={hotLeads.length} />
</div>
</section>

{/* ACTION CENTER */}
<section style={section}>
<h2>Action Center</h2>

<div style={grid2}>
<div>
<h3>🔥 Hot Leads</h3>
{hotLeads.map((l) => (
<div key={l.id}>
{l.name} — {l.score} — {getAgentName(l.assigned_agent)}
</div>
))}
</div>

<div>
<h3>⚠️ Unassigned</h3>
{unassignedLeads.map((l) => (
<div key={l.id}>
{l.name} — {l.source}
</div>
))}
</div>
</div>
</section>

{/* PIPELINE */}
<section style={section}>
<h2>Pipeline</h2>

<div style={grid3}>
<div>
<h3>Leads</h3>
{leads.slice(0, 10).map((l) => (
<div key={l.id}>
{l.name} — {l.status}
</div>
))}
</div>

<div>
<h3>Contacts</h3>
{contacts.slice(0, 10).map((c) => (
<div key={c.id}>
{c.full_name} — {getAgentName(c.agent_id)}
</div>
))}
</div>

<div>
<h3>Properties</h3>
{properties.slice(0, 10).map((p) => (
<div key={p.id}>
{p.address1} — {formatCurrency(p.price)}
</div>
))}
</div>
</div>
</section>

{/* LEADS (FULL CONTROL) */}
<section style={section}>
<h2>Leads Control</h2>

{leads.map((l) => (
<div key={l.id} style={{ marginBottom: 10 }}>
{l.name} — {l.email} — {l.status}

<button
onClick={() => convertLead(l)}
disabled={convertingLeadId === l.id}
style={btn}
>
Convert
</button>
</div>
))}
</section>

{/* PROPERTIES */}
<section style={section}>
<h2>Properties</h2>

{properties.map((p) => (
<div key={p.id}>
{p.address1} — {formatCurrency(p.price)} — {getContactName(p.contact_id)}
</div>
))}
</section>

<button onClick={loadData} style={btn}>
Refresh
</button>
</main>
)
}

// ---------------- UI ----------------

function Card({ label, value }: any) {
return (
<div style={card}>
<div>{label}</div>
<div style={{ fontSize: 22 }}>{value}</div>
</div>
)
}

// ---------------- STYLES ----------------

const main = { padding: 24, background: '#0b0b0b', color: 'white' }
const section = { marginBottom: 30 }
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }
const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }
const grid4 = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }
const card = { padding: 20, border: '1px solid #333' }
const btn = { marginLeft: 10, padding: 6, background: '#2563eb', color: 'white' }