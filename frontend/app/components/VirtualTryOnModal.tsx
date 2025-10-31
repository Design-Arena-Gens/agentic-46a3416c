'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

const AVATARS = [
  { id: 'athletic', label: 'Athletic', description: 'Toned build, medium height', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=60' },
  { id: 'petite', label: 'Petite', description: 'Shorter frame, slim fit', image: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=400&q=60' },
  { id: 'curvy', label: 'Curvy', description: 'Curvy silhouette, tall', image: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=400&q=60' }
];

export interface VirtualTryOnModalProps {
  open: boolean;
  product?: {
    id: string;
    title: string;
    thumbnail: string;
    brand: string;
  };
  onClose: () => void;
}

export function VirtualTryOnModal({ open, product, onClose }: VirtualTryOnModalProps) {
  const [avatarId, setAvatarId] = useState('athletic');

  const avatar = useMemo(() => AVATARS.find((item) => item.id === avatarId) ?? AVATARS[0], [avatarId]);

  if (!open || !product) return null;

  return (
    <div className="try-on-overlay" role="dialog" aria-modal>
      <div className="try-on-modal">
        <h2>Virtual Try-On (Preview)</h2>
        <p>
          Choose a base avatar that best matches you. We&apos;ll overlay the product on it for a quick vibe check.
          <br />
          <small>Integrate your 3D/AR provider here later.</small>
        </p>
        <div className="avatar-selector">
          {AVATARS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`avatar-option ${item.id === avatarId ? 'active' : ''}`}
              onClick={() => setAvatarId(item.id)}
            >
              <strong>{item.label}</strong>
              <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7 }}>{item.description}</span>
            </button>
          ))}
        </div>
        <div className="try-on-preview">
          <div style={{ position: 'relative', width: '100%', maxWidth: 320, height: 320 }}>
            <Image src={avatar.image} alt={`${avatar.label} avatar`} fill sizes="320px" style={{ objectFit: 'cover', borderRadius: 12, opacity: 0.8 }} />
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: 220, height: 220, marginTop: -240 }}>
            <Image src={product.thumbnail} alt={product.title} fill sizes="220px" style={{ objectFit: 'contain', filter: 'drop-shadow(0px 10px 30px rgba(59,130,246,0.45))' }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', opacity: 0.75 }}>
            This is a mocked visual. Connect to a real virtual try-on provider (Vue.ai, Bold Metrics, etc.) for production.
          </p>
        </div>
        <div className="try-on-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button type="button" onClick={onClose} style={{ background: 'rgba(34,197,94,0.2)', borderColor: 'rgba(34,197,94,0.5)' }}>
            Looks Great!
          </button>
        </div>
      </div>
    </div>
  );
}
