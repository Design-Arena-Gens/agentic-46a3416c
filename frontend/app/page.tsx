'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ChatMessage } from './components/ChatMessage';
import { ProductCard, type Product } from './components/ProductCard';
import { WishlistPanel } from './components/WishlistPanel';
import { ConversationSuggestions } from './components/ConversationSuggestions';
import { VirtualTryOnModal } from './components/VirtualTryOnModal';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const SESSION_STORAGE_KEY = 'ai-fashion-session';
const WISHLIST_STORAGE_KEY = 'ai-fashion-wishlist';

interface AssistantMessagePayload {
  text: string;
  followUp?: string;
}

interface ChatPayload {
  sessionId: string;
  message: AssistantMessagePayload;
  products: Product[];
  filters?: Record<string, unknown>;
  suggestions: string[];
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  followUp?: string;
  products?: Product[];
  createdAt: string;
}

export default function Page() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('Show me beige sneakers under ₹2000');
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: 'intro',
      role: 'assistant',
      content: 'Hi! I am your AI stylist. Ask me for outfits by color, fabric, budget, or vibe and I will curate 4-5 looks for you.',
      followUp: 'Try something like “red khaadi kurta for men under ₹3000”.',
      createdAt: new Date().toISOString()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(["Show me breezy linen kurtas", 'Something festive under ₹4000']);
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [likedProductIds, setLikedProductIds] = useState<string[]>([]);
  const [dislikedProductIds, setDislikedProductIds] = useState<string[]>([]);
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession) {
      setSessionId(storedSession);
    } else {
      const generated = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      setSessionId(generated);
      window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    }

    const storedWishlist = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (storedWishlist) {
      try {
        const parsed = JSON.parse(storedWishlist) as Product[];
        setWishlistItems(parsed);
        setSavedProductIds(parsed.map((item) => item.id));
      } catch (error) {
        console.warn('Failed to parse wishlist from storage', error);
      }
    }
  }, []);

  const fetchWishlistFromBackend = useCallback(async (activeSessionId: string) => {
    try {
      const response = await axios.get<{ items: Product[] }>(`${BACKEND_URL}/api/wishlist`, {
        params: { sessionId: activeSessionId }
      });
      setWishlistItems(response.data.items);
      setSavedProductIds(response.data.items.map((item) => item.id));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(response.data.items));
      }
    } catch (error) {
      console.error('Failed to sync wishlist', error);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetchWishlistFromBackend(sessionId);
  }, [fetchWishlistFromBackend, sessionId]);

  const pushMessage = useCallback((entry: ChatEntry) => {
    setMessages((prev) => [...prev, entry]);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;
    const currentSession = sessionId || window.localStorage.getItem(SESSION_STORAGE_KEY) || window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    if (!sessionId) {
      setSessionId(currentSession);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SESSION_STORAGE_KEY, currentSession);
      }
    }

    const outbound = input.trim();
    setInput('');
    setSuggestedPrompts([]);
    const userEntry: ChatEntry = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: outbound,
      createdAt: new Date().toISOString()
    };
    pushMessage(userEntry);
    setIsLoading(true);

    try {
      const response = await axios.post<ChatPayload>(`${BACKEND_URL}/api/chat`, {
        sessionId: currentSession,
        message: outbound
      });

      const { message, products, sessionId: resolvedSession, suggestions } = response.data;
      if (resolvedSession && resolvedSession !== currentSession) {
        setSessionId(resolvedSession);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SESSION_STORAGE_KEY, resolvedSession);
        }
        await fetchWishlistFromBackend(resolvedSession);
      }

      const assistantEntry: ChatEntry = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: message.text,
        followUp: message.followUp,
        products,
        createdAt: new Date().toISOString()
      };
      pushMessage(assistantEntry);
      setSuggestedPrompts(suggestions || []);
    } catch (error) {
      console.error('Chat request failed', error);
      pushMessage({
        id: `${Date.now()}-assistant-error`,
        role: 'assistant',
        content: 'I had trouble reaching the catalog. Please try again in a moment.',
        createdAt: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchWishlistFromBackend, input, pushMessage, sessionId]);

  const handleSuggestion = useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    []
  );

  const persistWishlist = useCallback((items: Product[]) => {
    setWishlistItems(items);
    setSavedProductIds(items.map((item) => item.id));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    }
  }, []);

  const sendFeedback = useCallback(
    async (product: Product, action: 'like' | 'dislike' | 'save' | 'remove-save') => {
      const currentSession = sessionId || window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!currentSession) return;
      try {
        await axios.post(`${BACKEND_URL}/api/feedback`, {
          sessionId: currentSession,
          productId: product.id,
          action
        });
      } catch (error) {
        console.error('Failed to send feedback', error);
      }
    },
    [sessionId]
  );

  const handleLike = useCallback(
    async (product: Product) => {
      await sendFeedback(product, 'like');
      setLikedProductIds((prev) => (prev.includes(product.id) ? prev : [...prev, product.id]));
      setDislikedProductIds((prev) => prev.filter((id) => id !== product.id));
    },
    [sendFeedback]
  );

  const handleDislike = useCallback(
    async (product: Product) => {
      await sendFeedback(product, 'dislike');
      setDislikedProductIds((prev) => (prev.includes(product.id) ? prev : [...prev, product.id]));
      setLikedProductIds((prev) => prev.filter((id) => id !== product.id));
      persistWishlist(wishlistItems.filter((item) => item.id !== product.id));
    },
    [persistWishlist, sendFeedback, wishlistItems]
  );

  const handleSave = useCallback(
    async (product: Product, alreadySaved: boolean) => {
      await sendFeedback(product, alreadySaved ? 'remove-save' : 'save');
      if (alreadySaved) {
        persistWishlist(wishlistItems.filter((item) => item.id !== product.id));
      } else {
        const next = [...wishlistItems.filter((item) => item.id !== product.id), product];
        persistWishlist(next);
      }
    },
    [persistWishlist, sendFeedback, wishlistItems]
  );

  const handleRemoveSaved = useCallback(
    async (productId: string) => {
      const target = wishlistItems.find((item) => item.id === productId);
      if (!target) return;
      await sendFeedback(target, 'remove-save');
      persistWishlist(wishlistItems.filter((item) => item.id !== productId));
    },
    [persistWishlist, sendFeedback, wishlistItems]
  );

  const flattenedProducts = useMemo(() => {
    return messages.flatMap((entry) => entry.products || []);
  }, [messages]);

  const renderProducts = useCallback(
    (entry: ChatEntry) => {
      if (!entry.products || entry.products.length === 0) return null;
      return (
        <div className="product-grid">
          {entry.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSaved={savedProductIds.includes(product.id)}
              isLiked={likedProductIds.includes(product.id)}
              onLike={handleLike}
              onDislike={handleDislike}
              onSave={handleSave}
              onTryOn={(product) => setTryOnProduct(product)}
            />
          ))}
        </div>
      );
    },
    [handleDislike, handleLike, handleSave, likedProductIds, savedProductIds, setTryOnProduct]
  );

  return (
    <main className="chat-shell">
      <VirtualTryOnModal open={Boolean(tryOnProduct)} product={tryOnProduct || undefined} onClose={() => setTryOnProduct(null)} />
      <div className="chat-header">
        <h1>Agentic Fashion Concierge</h1>
        <span style={{ fontSize: '0.85rem', opacity: 0.72 }}>
          Session: {sessionId?.slice(0, 8)} · {flattenedProducts.length} styles explored
        </span>
      </div>
      <div className="chat-content">
        <section>
          <div className="message-board">
            {messages.map((entry) => (
              <div key={entry.id}>
                <ChatMessage role={entry.role}>{entry.content}</ChatMessage>
                {entry.followUp ? (
                  <div className="recap-card">
                    <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{entry.followUp}</span>
                  </div>
                ) : null}
                {renderProducts(entry)}
              </div>
            ))}
            {isLoading ? (
              <ChatMessage role="assistant">Let me scout the runway for you…</ChatMessage>
            ) : null}
          </div>
          <ConversationSuggestions prompts={suggestedPrompts} onSelect={handleSuggestion} />
          <div className="message-input">
            <textarea
              value={input}
              placeholder="Try “monochrome athleisure look under ₹5000”"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button type="button" onClick={handleSendMessage} disabled={isLoading}>
              {isLoading ? 'Curating…' : 'Send'}
            </button>
          </div>
        </section>
        <WishlistPanel items={wishlistItems} onRemove={handleRemoveSaved} />
      </div>
    </main>
  );
}
