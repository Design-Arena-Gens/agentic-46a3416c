'use client';

import Image from 'next/image';

export interface WishlistItem {
  id: string;
  title: string;
  brand: string;
  price: number;
  currency: string;
  thumbnail: string;
}

interface WishlistPanelProps {
  items: WishlistItem[];
  onRemove: (productId: string) => void;
}

export function WishlistPanel({ items, onRemove }: WishlistPanelProps) {
  return (
    <aside className="wishlist-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Saved Looks</h3>
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{items.length} saved</span>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Tap the heart on any product to keep it here.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="wishlist-item">
            <div style={{ position: 'relative', width: 52, height: 52 }}>
              <Image src={item.thumbnail} alt={item.title} fill sizes="52px" style={{ objectFit: 'cover', borderRadius: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: '0.9rem' }}>{item.title}</strong>
              <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>{item.brand}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: item.currency || 'INR',
                  maximumFractionDigits: 0
                }).format(item.price)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              style={{ borderRadius: 12, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '6px 10px', cursor: 'pointer' }}
            >
              Remove
            </button>
          </div>
        ))
      )}
    </aside>
  );
}
