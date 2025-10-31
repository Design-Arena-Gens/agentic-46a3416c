'use client';

import Image from 'next/image';
import { useMemo } from 'react';

export interface Product {
  id: string;
  title: string;
  brand: string;
  color: string;
  material: string;
  sizeOptions: string[];
  price: number;
  currency: string;
  thumbnail: string;
  productUrl: string;
  description?: string;
  fabric?: string;
}

export interface ProductCardProps {
  product: Product;
  isSaved: boolean;
  isLiked: boolean;
  onLike: (product: Product) => void;
  onDislike: (product: Product) => void;
  onSave: (product: Product, saved: boolean) => void;
  onTryOn: (product: Product) => void;
}

export function ProductCard({
  product,
  isSaved,
  isLiked,
  onLike,
  onDislike,
  onSave,
  onTryOn
}: ProductCardProps) {
  const priceLabel = useMemo(() => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: product.currency || 'INR',
      maximumFractionDigits: 0
    }).format(product.price);
  }, [product.currency, product.price]);

  return (
    <div className="product-card" data-product-id={product.id}>
      <div style={{ position: 'relative', width: '100%', height: 180 }}>
        <Image
          className="product-thumbnail"
          src={product.thumbnail}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 100vw, 220px"
          style={{ objectFit: 'cover' }}
        />
      </div>
      <div className="product-meta">
        <strong>{product.title}</strong>
        <span>{product.brand}</span>
        <span>
          {priceLabel} · {product.color}
        </span>
        <span>{product.material}</span>
        <span>Sizes: {product.sizeOptions.join(', ')}</span>
      </div>
      <div className="product-actions">
        <a href={product.productUrl} target="_blank" rel="noopener noreferrer">
          🔗 View Product
        </a>
        <button className="try-on" onClick={() => onTryOn(product)}>
          👗 Virtual Try-On
        </button>
        <button className="like" onClick={() => onLike(product)}>
          {isLiked ? '❤️ Liked' : '🤍 Like'}
        </button>
        <button className="dislike" onClick={() => onDislike(product)}>
          👎 Dislike
        </button>
        <button className="save" onClick={() => onSave(product, isSaved)}>
          {isSaved ? '💾 Saved' : '❤️ Save'}
        </button>
      </div>
    </div>
  );
}
