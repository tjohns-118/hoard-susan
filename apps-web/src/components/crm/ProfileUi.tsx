'use client';

/**
 * Shared buyer/seller profile UI.
 * Used by both /contacts and /leads pages — do not add page-specific logic here.
 *
 * Exports:
 *   EMPTY_BUYER, EMPTY_SELLER         — blank profile seeds
 *   PROP_TYPE_LABELS, CONDITION_LABELS — human-readable label maps
 *   fmtPrice                           — compact currency formatter
 *   inputStyle, selectStyle            — shared field styles
 *   FieldLabel                         — label micro-component
 *   TagPills                           — controlled multi-select pill row
 *   RoleBadge                          — buyer / seller / both indicator
 *   ProfileSummary                     — compact read-only profile line(s)
 *   ProfilePanel                       — full read + edit profile section
 */

import { useState } from 'react';
import type {
  BuyerProfile, SellerProfile, ContactRole,
  BuyerTag, SellerTag, PropertyType, SellerCondition,
} from '@/features/contacts/types';
import {
  BUYER_TAGS, SELLER_TAGS, PROPERTY_TYPES, SELLER_CONDITIONS,
} from '@/features/contacts/types';

// ── Empty seeds ───────────────────────────────────────────────────────────────

export const EMPTY_BUYER:  BuyerProfile  = { tags: [] };
export const EMPTY_SELLER: SellerProfile = { tags: [] };

// ── Label maps ────────────────────────────────────────────────────────────────

export const PROP_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: 'Single Family', condo: 'Condo', townhouse: 'Townhouse',
  ranch: 'Ranch', land: 'Land', commercial: 'Commercial',
  multi_family: 'Multi-Family', waterfront: 'Waterfront', cabin: 'Cabin',
};

export const CONDITION_LABELS: Record<SellerCondition, string> = {
  move_in_ready: 'Move-In Ready', needs_repairs: 'Needs Repairs',
  as_is: 'As-Is', new_construction: 'New Construction', fixer_upper: 'Fixer-Upper',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

export function fmtPrice(n?: number): string {
  if (!n) return '';
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 7,
  border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
  color: 'var(--r-text)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', fontWeight: 600,
};

// ── FieldLabel ────────────────────────────────────────────────────────────────

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
      {children}
    </div>
  );
}

// ── TagPills ──────────────────────────────────────────────────────────────────

export function TagPills<T extends string>({
  options,
  selected,
  onChange,
}: {
  options:  readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
      {options.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(active ? selected.filter((t) => t !== tag) : [...selected, tag])}
            style={{
              padding: '3px 9px', borderRadius: 6, fontSize: 11,
              fontWeight: active ? 700 : 500, cursor: 'pointer', letterSpacing: '0.01em',
              background: active ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.03)',
              border: `1px solid ${active ? 'var(--r-gold-bright)' : 'var(--r-border)'}`,
              color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
            }}
          >
            {tag.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────

export function RoleBadge({ role }: { role: ContactRole | undefined }) {
  if (!role) return null;
  const isBuyer  = role === 'buyer'  || role === 'both';
  const isSeller = role === 'seller' || role === 'both';
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {isBuyer  && <span style={{ fontSize: 10, fontWeight: 700, color: '#6fa8d6', background: 'rgba(111,168,214,0.12)', border: '1px solid rgba(111,168,214,0.3)', borderRadius: 5, padding: '1px 6px', letterSpacing: '0.04em' }}>BUYER</span>}
      {isSeller && <span style={{ fontSize: 10, fontWeight: 700, color: '#85c28e', background: 'rgba(133,194,142,0.12)', border: '1px solid rgba(133,194,142,0.3)', borderRadius: 5, padding: '1px 6px', letterSpacing: '0.04em' }}>SELLER</span>}
    </span>
  );
}

// ── ProfileSubject ────────────────────────────────────────────────────────────
// Minimal interface satisfied by both Contact and Lead.

export interface ProfileSubject {
  id:              string;
  role?:           ContactRole;
  buyerProfile?:   BuyerProfile;
  sellerProfile?:  SellerProfile;
}

// ── ProfileSummary ────────────────────────────────────────────────────────────

export function ProfileSummary({ subject }: { subject: ProfileSubject }) {
  const lines: string[] = [];

  if (subject.buyerProfile) {
    const bp = subject.buyerProfile;
    const parts: string[] = [];
    if (bp.targetArea) parts.push(bp.targetArea);
    if (bp.priceMin || bp.priceMax) {
      parts.push(`${fmtPrice(bp.priceMin) || '?'}–${fmtPrice(bp.priceMax) || '?'}`);
    }
    if (bp.bedsMin) parts.push(`${bp.bedsMin}bd+`);
    if (bp.propertyType) parts.push(PROP_TYPE_LABELS[bp.propertyType] ?? bp.propertyType);
    if (parts.length) lines.push(`B: ${parts.join(' · ')}`);
  }

  if (subject.sellerProfile) {
    const sp = subject.sellerProfile;
    const parts: string[] = [];
    if (sp.propertyLocation) parts.push(sp.propertyLocation);
    if (sp.beds && sp.baths) parts.push(`${sp.beds}bd/${sp.baths}ba`);
    if (sp.condition) parts.push(CONDITION_LABELS[sp.condition] ?? sp.condition);
    if (sp.estimatedValue) parts.push(fmtPrice(sp.estimatedValue));
    if (parts.length) lines.push(`S: ${parts.join(' · ')}`);
  }

  if (!lines.length) return null;
  return (
    <div style={{ fontSize: 10, color: 'var(--r-text-3)', lineHeight: 1.5, marginTop: 3 }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

// ── ProfilePanel ──────────────────────────────────────────────────────────────
// Full read + edit panel. Renders read view by default; clicking Edit opens
// the structured form for role selection and buyer/seller profile fields.

export function ProfilePanel({
  subject,
  onUpdateBuyerProfile,
  onUpdateSellerProfile,
}: {
  subject:               ProfileSubject;
  onUpdateBuyerProfile:  (id: string, p: BuyerProfile  | null, role: ContactRole) => Promise<void>;
  onUpdateSellerProfile: (id: string, p: SellerProfile | null, role: ContactRole) => Promise<void>;
}) {
  const [editing,  setEditing]  = useState(false);
  const [role,     setRole]     = useState<ContactRole>(subject.role ?? 'buyer');
  const [buyer,    setBuyer]    = useState<BuyerProfile>(subject.buyerProfile   ?? EMPTY_BUYER);
  const [seller,   setSeller]   = useState<SellerProfile>(subject.sellerProfile ?? EMPTY_SELLER);
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');

  const startEdit = () => {
    setRole(subject.role ?? 'buyer');
    setBuyer(subject.buyerProfile   ?? EMPTY_BUYER);
    setSeller(subject.sellerProfile ?? EMPTY_SELLER);
    setSaveErr('');
    setEditing(true);
  };

  const hasBuyer  = role === 'buyer'  || role === 'both';
  const hasSeller = role === 'seller' || role === 'both';

  async function handleSave() {
    setSaving(true);
    setSaveErr('');
    try {
      await onUpdateBuyerProfile(subject.id,  hasBuyer  ? buyer  : null, role);
      await onUpdateSellerProfile(subject.id, hasSeller ? seller : null, role);
      setEditing(false);
    } catch (e: any) {
      setSaveErr(e?.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  // ── Read mode ─────────────────────────────────────────────────────────────

  if (!editing) {
    const hasAny = subject.buyerProfile || subject.sellerProfile || subject.role;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasAny ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RoleBadge role={subject.role} />
            {!hasAny && <span style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>No profile set</span>}
          </div>
          <button onClick={startEdit} style={{ background: 'none', border: '1px solid var(--r-border)', borderRadius: 7, color: 'var(--r-text-3)', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
            {hasAny ? 'Edit' : 'Set up profile'}
          </button>
        </div>

        {subject.buyerProfile && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6fa8d6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Buyer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {([
                ['Area',      subject.buyerProfile.targetArea],
                ['Price',     [fmtPrice(subject.buyerProfile.priceMin), fmtPrice(subject.buyerProfile.priceMax)].filter(Boolean).join('–') || null],
                ['Type',      subject.buyerProfile.propertyType ? PROP_TYPE_LABELS[subject.buyerProfile.propertyType] : null],
                ['Beds min',  subject.buyerProfile.bedsMin  ? `${subject.buyerProfile.bedsMin}+`  : null],
                ['Baths min', subject.buyerProfile.bathsMin ? `${subject.buyerProfile.bathsMin}+` : null],
                ['Sqft min',  subject.buyerProfile.sqftMin  ? subject.buyerProfile.sqftMin.toLocaleString() : null],
              ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--r-text-2)' }}>{val}</div>
                </div>
              ))}
            </div>
            {subject.buyerProfile.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
                {subject.buyerProfile.tags.map((t) => (
                  <span key={t} style={{ fontSize: 10, fontWeight: 600, color: '#6fa8d6', background: 'rgba(111,168,214,0.1)', border: '1px solid rgba(111,168,214,0.25)', borderRadius: 5, padding: '1px 6px' }}>
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {subject.sellerProfile && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#85c28e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Seller</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {([
                ['Location',   subject.sellerProfile.propertyLocation],
                ['Beds',       subject.sellerProfile.beds  ? `${subject.sellerProfile.beds}`  : null],
                ['Baths',      subject.sellerProfile.baths ? `${subject.sellerProfile.baths}` : null],
                ['Sqft',       subject.sellerProfile.sqft  ? subject.sellerProfile.sqft.toLocaleString() : null],
                ['Type',       subject.sellerProfile.propertyType ? PROP_TYPE_LABELS[subject.sellerProfile.propertyType] : null],
                ['Condition',  subject.sellerProfile.condition ? CONDITION_LABELS[subject.sellerProfile.condition] : null],
                ['Est. Value', subject.sellerProfile.estimatedValue ? fmtPrice(subject.sellerProfile.estimatedValue) : null],
              ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--r-text-2)' }}>{val}</div>
                </div>
              ))}
            </div>
            {subject.sellerProfile.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
                {subject.sellerProfile.tags.map((t) => (
                  <span key={t} style={{ fontSize: 10, fontWeight: 600, color: '#85c28e', background: 'rgba(133,194,142,0.1)', border: '1px solid rgba(133,194,142,0.25)', borderRadius: 5, padding: '1px 6px' }}>
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Role selector */}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Contact Role</FieldLabel>
        <div style={{ display: 'flex', gap: 7 }}>
          {(['buyer', 'seller', 'both'] as ContactRole[]).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                fontWeight: role === r ? 700 : 500, cursor: 'pointer', textTransform: 'capitalize',
                background: role === r ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.03)',
                border: `1px solid ${role === r ? 'var(--r-gold-bright)' : 'var(--r-border)'}`,
                color: role === r ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
              }}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Buyer fields */}
      {hasBuyer && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6fa8d6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Buyer Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div><FieldLabel>Target Area</FieldLabel>
              <input style={inputStyle} value={buyer.targetArea ?? ''} onChange={(e) => setBuyer({ ...buyer, targetArea: e.target.value || undefined })} placeholder="Grand Lake, Austin..." />
            </div>
            <div><FieldLabel>Property Type</FieldLabel>
              <select style={selectStyle} value={buyer.propertyType ?? ''} onChange={(e) => setBuyer({ ...buyer, propertyType: (e.target.value as PropertyType) || undefined })}>
                <option value="">Any</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROP_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Price Min</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.priceMin ?? ''} onChange={(e) => setBuyer({ ...buyer, priceMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="500000" />
            </div>
            <div><FieldLabel>Price Max</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.priceMax ?? ''} onChange={(e) => setBuyer({ ...buyer, priceMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="1200000" />
            </div>
            <div><FieldLabel>Beds (min)</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.bedsMin ?? ''} onChange={(e) => setBuyer({ ...buyer, bedsMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="3" />
            </div>
            <div><FieldLabel>Baths (min)</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.bathsMin ?? ''} onChange={(e) => setBuyer({ ...buyer, bathsMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="2" />
            </div>
            <div><FieldLabel>Sqft (min)</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.sqftMin ?? ''} onChange={(e) => setBuyer({ ...buyer, sqftMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="1500" />
            </div>
          </div>
          <div style={{ marginTop: 10 }}><FieldLabel>Buyer Tags</FieldLabel>
            <TagPills<BuyerTag> options={BUYER_TAGS} selected={buyer.tags} onChange={(tags) => setBuyer({ ...buyer, tags })} />
          </div>
        </div>
      )}

      {/* Seller fields */}
      {hasSeller && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#85c28e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Seller Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div><FieldLabel>Property Location</FieldLabel>
              <input style={inputStyle} value={seller.propertyLocation ?? ''} onChange={(e) => setSeller({ ...seller, propertyLocation: e.target.value || undefined })} placeholder="123 Main St, Austin TX" />
            </div>
            <div><FieldLabel>Property Type</FieldLabel>
              <select style={selectStyle} value={seller.propertyType ?? ''} onChange={(e) => setSeller({ ...seller, propertyType: (e.target.value as PropertyType) || undefined })}>
                <option value="">Select...</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROP_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Beds</FieldLabel>
              <input style={inputStyle} type="number" value={seller.beds ?? ''} onChange={(e) => setSeller({ ...seller, beds: e.target.value ? Number(e.target.value) : undefined })} placeholder="3" />
            </div>
            <div><FieldLabel>Baths</FieldLabel>
              <input style={inputStyle} type="number" value={seller.baths ?? ''} onChange={(e) => setSeller({ ...seller, baths: e.target.value ? Number(e.target.value) : undefined })} placeholder="2" />
            </div>
            <div><FieldLabel>Sqft</FieldLabel>
              <input style={inputStyle} type="number" value={seller.sqft ?? ''} onChange={(e) => setSeller({ ...seller, sqft: e.target.value ? Number(e.target.value) : undefined })} placeholder="1800" />
            </div>
            <div><FieldLabel>Condition</FieldLabel>
              <select style={selectStyle} value={seller.condition ?? ''} onChange={(e) => setSeller({ ...seller, condition: (e.target.value as SellerCondition) || undefined })}>
                <option value="">Select...</option>
                {SELLER_CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Estimated Value</FieldLabel>
              <input style={inputStyle} type="number" value={seller.estimatedValue ?? ''} onChange={(e) => setSeller({ ...seller, estimatedValue: e.target.value ? Number(e.target.value) : undefined })} placeholder="850000" />
            </div>
          </div>
          <div style={{ marginTop: 10 }}><FieldLabel>Seller Tags</FieldLabel>
            <TagPills<SellerTag> options={SELLER_TAGS} selected={seller.tags} onChange={(tags) => setSeller({ ...seller, tags })} />
          </div>
        </div>
      )}

      {saveErr && <div style={{ fontSize: 11, color: 'var(--r-danger)', marginBottom: 8 }}>{saveErr}</div>}

      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', color: 'var(--r-gold)', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
        <button onClick={() => setEditing(false)}
          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: '1px solid var(--r-border)', color: 'var(--r-text-3)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── ProfileFormSection ────────────────────────────────────────────────────────
// Embeds role selector + conditional buyer/seller profile fields inside a
// "create" form. Parent owns the state; receives setter callbacks.

export function ProfileFormSection({
  role,     setRole,
  buyer,    setBuyer,
  seller,   setSeller,
}: {
  role:      ContactRole;
  setRole:   (r: ContactRole) => void;
  buyer:     BuyerProfile;
  setBuyer:  (b: BuyerProfile) => void;
  seller:    SellerProfile;
  setSeller: (s: SellerProfile) => void;
}) {
  const hasBuyer  = role === 'buyer'  || role === 'both';
  const hasSeller = role === 'seller' || role === 'both';

  return (
    <>
      {/* Role selector */}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Contact Role</FieldLabel>
        <div style={{ display: 'flex', gap: 7 }}>
          {(['buyer', 'seller', 'both'] as ContactRole[]).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                fontWeight: role === r ? 700 : 500, cursor: 'pointer', textTransform: 'capitalize',
                background: role === r ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.03)',
                border: `1px solid ${role === r ? 'var(--r-gold-bright)' : 'var(--r-border)'}`,
                color: role === r ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
              }}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Buyer profile */}
      {hasBuyer && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(111,168,214,0.05)', border: '1px solid rgba(111,168,214,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6fa8d6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Buyer Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><FieldLabel>Target Area</FieldLabel>
              <input style={inputStyle} value={buyer.targetArea ?? ''} onChange={(e) => setBuyer({ ...buyer, targetArea: e.target.value || undefined })} placeholder="Area..." />
            </div>
            <div><FieldLabel>Price Min</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.priceMin ?? ''} onChange={(e) => setBuyer({ ...buyer, priceMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="500000" />
            </div>
            <div><FieldLabel>Price Max</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.priceMax ?? ''} onChange={(e) => setBuyer({ ...buyer, priceMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="1200000" />
            </div>
            <div><FieldLabel>Property Type</FieldLabel>
              <select style={selectStyle} value={buyer.propertyType ?? ''} onChange={(e) => setBuyer({ ...buyer, propertyType: (e.target.value as PropertyType) || undefined })}>
                <option value="">Any</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROP_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Beds min</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.bedsMin ?? ''} onChange={(e) => setBuyer({ ...buyer, bedsMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="3" />
            </div>
            <div><FieldLabel>Baths min</FieldLabel>
              <input style={inputStyle} type="number" value={buyer.bathsMin ?? ''} onChange={(e) => setBuyer({ ...buyer, bathsMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="2" />
            </div>
          </div>
          <FieldLabel>Buyer Tags</FieldLabel>
          <TagPills<BuyerTag> options={BUYER_TAGS} selected={buyer.tags} onChange={(tags) => setBuyer({ ...buyer, tags })} />
        </div>
      )}

      {/* Seller profile */}
      {hasSeller && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(133,194,142,0.05)', border: '1px solid rgba(133,194,142,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#85c28e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Seller Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><FieldLabel>Location</FieldLabel>
              <input style={inputStyle} value={seller.propertyLocation ?? ''} onChange={(e) => setSeller({ ...seller, propertyLocation: e.target.value || undefined })} placeholder="Address..." />
            </div>
            <div><FieldLabel>Property Type</FieldLabel>
              <select style={selectStyle} value={seller.propertyType ?? ''} onChange={(e) => setSeller({ ...seller, propertyType: (e.target.value as PropertyType) || undefined })}>
                <option value="">Select</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROP_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Condition</FieldLabel>
              <select style={selectStyle} value={seller.condition ?? ''} onChange={(e) => setSeller({ ...seller, condition: (e.target.value as SellerCondition) || undefined })}>
                <option value="">Select</option>
                {SELLER_CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Beds</FieldLabel>
              <input style={inputStyle} type="number" value={seller.beds ?? ''} onChange={(e) => setSeller({ ...seller, beds: e.target.value ? Number(e.target.value) : undefined })} placeholder="3" />
            </div>
            <div><FieldLabel>Baths</FieldLabel>
              <input style={inputStyle} type="number" value={seller.baths ?? ''} onChange={(e) => setSeller({ ...seller, baths: e.target.value ? Number(e.target.value) : undefined })} placeholder="2" />
            </div>
            <div><FieldLabel>Est. Value</FieldLabel>
              <input style={inputStyle} type="number" value={seller.estimatedValue ?? ''} onChange={(e) => setSeller({ ...seller, estimatedValue: e.target.value ? Number(e.target.value) : undefined })} placeholder="850000" />
            </div>
          </div>
          <FieldLabel>Seller Tags</FieldLabel>
          <TagPills<SellerTag> options={SELLER_TAGS} selected={seller.tags} onChange={(tags) => setSeller({ ...seller, tags })} />
        </div>
      )}
    </>
  );
}
