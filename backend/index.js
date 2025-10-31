require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const Redis = require('ioredis');
const { v4: uuid } = require('uuid');
const { parseQuery } = require('../utils/parseQuery');

const app = express();
const PORT = process.env.PORT || 4000;

const productDataPath = path.join(__dirname, '..', 'productData.json');
const products = JSON.parse(fs.readFileSync(productDataPath, 'utf8'));

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl);

const razorpayConfigured =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
const razorpayClient = razorpayConfigured
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  })
);
app.use(express.json());

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

const defaultSessionState = () => ({
  preferences: {
    likedBrands: [],
    likedProductIds: [],
    dislikedProductIds: [],
    savedProductIds: [],
    colors: [],
    materials: [],
    priceRange: {
      min: null,
      max: null
    }
  },
  history: []
});

const sessionKey = (sessionId) => `session:${sessionId}`;

async function readSession(sessionId) {
  const raw = await redis.get(sessionKey(sessionId));
  if (!raw) {
    return defaultSessionState();
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse session state, resetting', error.message);
    return defaultSessionState();
  }
}

async function writeSession(sessionId, state) {
  await redis.set(sessionKey(sessionId), JSON.stringify(state), 'EX', SESSION_TTL_SECONDS);
  return state;
}

function normalizeText(value) {
  return value ? value.toLowerCase() : value;
}

function productMatchesFilters(product, filters) {
  if (!filters) return true;
  const { category, color, material, gender, brand, budget, size } = filters;

  if (category && !normalizeText(product.category).includes(category)) {
    return false;
  }
  if (color && normalizeText(product.color) !== color) {
    return false;
  }
  if (material && !normalizeText(product.material).includes(material)) {
    return false;
  }
  if (gender && product.gender && normalizeText(product.gender) !== gender && normalizeText(product.gender) !== 'unisex') {
    return false;
  }
  if (brand && !normalizeText(product.brand).includes(brand)) {
    return false;
  }
  if (budget) {
    if (budget.min && product.price < budget.min) {
      return false;
    }
    if (budget.max && product.price > budget.max) {
      return false;
    }
  }
  if (size && Array.isArray(size) && size.length > 0) {
    const normalizedSizes = product.sizeOptions.map((option) => option.toUpperCase());
    const hasAny = size.some((requested) => normalizedSizes.includes(requested.toUpperCase()));
    if (!hasAny) {
      return false;
    }
  }
  return true;
}

function rankProducts(candidateProducts, sessionState) {
  const state = sessionState || defaultSessionState();
  return candidateProducts
    .filter((product) => !state.preferences.dislikedProductIds.includes(product.id))
    .map((product) => {
      let score = 0;
      if (state.preferences.likedBrands.includes(normalizeText(product.brand))) {
        score += 3;
      }
      if (state.preferences.colors.includes(normalizeText(product.color))) {
        score += 2;
      }
      if (state.preferences.materials.includes(normalizeText(product.material))) {
        score += 1;
      }
      if (state.preferences.likedProductIds.includes(product.id)) {
        score += 5;
      }
      return { product, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);
}

function buildAssistantMessage(filters, results) {
  if (results.length === 0) {
    return {
      text: 'I could not find a perfect match yet. Would you like to adjust the color, price range, or category?'
    };
  }

  const descriptors = [];
  if (filters?.color) descriptors.push(filters.color);
  if (filters?.material) descriptors.push(filters.material);
  if (filters?.category) descriptors.push(filters.category + (filters.gender ? ` for ${filters.gender}` : ''));

  const intro = descriptors.length > 0
    ? `Here are some ${descriptors.join(' ')} options I picked for you:`
    : 'Here are a few recommendations I think you will like:';

  const followUp = 'Would you like to narrow this down by delivery time, rating, or explore similar styles?';

  return {
    text: intro,
    followUp
  };
}

function augmentSessionWithFilters(sessionState, filters) {
  if (!filters) return sessionState;
  const updated = { ...sessionState };
  const prefs = { ...updated.preferences };

  if (filters.brand) {
    const brand = normalizeText(filters.brand);
    if (!prefs.likedBrands.includes(brand)) {
      prefs.likedBrands.push(brand);
    }
  }
  if (filters.color) {
    const color = normalizeText(filters.color);
    if (!prefs.colors.includes(color)) {
      prefs.colors.push(color);
    }
  }
  if (filters.material) {
    const material = normalizeText(filters.material);
    if (!prefs.materials.includes(material)) {
      prefs.materials.push(material);
    }
  }
  if (filters.budget) {
    prefs.priceRange = {
      min: filters.budget.min ?? prefs.priceRange.min,
      max: filters.budget.max ?? prefs.priceRange.max
    };
  }

  updated.preferences = prefs;
  return updated;
}

function summarizeProduct(product) {
  return {
    id: product.id,
    title: product.title,
    brand: product.brand,
    color: product.color,
    sizeOptions: product.sizeOptions,
    material: product.material,
    price: product.price,
    currency: product.currency,
    thumbnail: product.thumbnail,
    productUrl: product.productUrl,
    description: product.description,
    fabric: product.fabric
  };
}

function buildSuggestions(filters) {
  const suggestions = [];
  if (!filters?.color) suggestions.push('Show me the same style in a different color');
  if (!filters?.budget?.max) suggestions.push('Keep it under ₹2500');
  if (!filters?.material) suggestions.push('Find something in breathable linen');
  suggestions.push('Show me more casual weekend outfits');
  return suggestions.slice(0, 3);
}

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const resolvedSessionId = sessionId || uuid();
    const sessionState = await readSession(resolvedSessionId);
    const { filters, meta } = await parseQuery(message);
    const enrichedState = augmentSessionWithFilters(sessionState, filters);

    const matching = products.filter((product) => productMatchesFilters(product, filters));
    const ranked = rankProducts(matching.length > 0 ? matching : products, enrichedState);
    const quantity = Math.min(Math.max(meta?.quantity || 4, 1), 5);
    const topPicks = ranked.slice(0, quantity).map(summarizeProduct);

    const assistantMessage = buildAssistantMessage(filters, topPicks);

    const historyEntry = {
      timestamp: new Date().toISOString(),
      userMessage: message,
      filters,
      responseProductIds: topPicks.map((item) => item.id)
    };

    enrichedState.history = [...(enrichedState.history || []), historyEntry].slice(-15);

    await writeSession(resolvedSessionId, enrichedState);

    return res.json({
      sessionId: resolvedSessionId,
      message: assistantMessage,
      products: topPicks,
      filters,
      suggestions: buildSuggestions(filters)
    });
  } catch (error) {
    console.error('Chat endpoint failed', error);
    return res.status(500).json({ error: 'Failed to process query' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { sessionId, productId, action } = req.body;
    if (!sessionId || !productId || !action) {
      return res.status(400).json({ error: 'sessionId, productId and action are required' });
    }

    const state = await readSession(sessionId);
    const prefs = { ...state.preferences };

    switch (action) {
      case 'like':
        if (!prefs.likedProductIds.includes(productId)) {
          prefs.likedProductIds.push(productId);
        }
        prefs.dislikedProductIds = prefs.dislikedProductIds.filter((id) => id !== productId);
        break;
      case 'dislike':
        if (!prefs.dislikedProductIds.includes(productId)) {
          prefs.dislikedProductIds.push(productId);
        }
        prefs.likedProductIds = prefs.likedProductIds.filter((id) => id !== productId);
        prefs.savedProductIds = prefs.savedProductIds.filter((id) => id !== productId);
        break;
      case 'save':
        if (!prefs.savedProductIds.includes(productId)) {
          prefs.savedProductIds.push(productId);
        }
        break;
      case 'remove-save':
        prefs.savedProductIds = prefs.savedProductIds.filter((id) => id !== productId);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported feedback action' });
    }

    state.preferences = prefs;
    await writeSession(sessionId, state);

    return res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('Feedback endpoint failed', error);
    return res.status(500).json({ error: 'Failed to update feedback' });
  }
});

app.get('/api/wishlist', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const state = await readSession(sessionId);
    const savedProducts = state.preferences.savedProductIds.map((id) => products.find((product) => product.id === id)).filter(Boolean).map(summarizeProduct);
    return res.json({ items: savedProducts });
  } catch (error) {
    console.error('Wishlist endpoint failed', error);
    return res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

app.get('/api/preferences', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const state = await readSession(sessionId);
    return res.json({ preferences: state.preferences, history: state.history });
  } catch (error) {
    console.error('Preferences endpoint failed', error);
    return res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

app.post('/api/payment/create-order', async (req, res) => {
  try {
    if (!razorpayClient) {
      return res.status(500).json({ error: 'Razorpay is not configured' });
    }
    const { amount, currency = 'INR', notes = {} } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const options = {
      amount: amount * 100,
      currency,
      receipt: `order_${Date.now()}`,
      notes
    };

    const order = await razorpayClient.orders.create(options);
    return res.json({ order });
  } catch (error) {
    console.error('Payment order creation failed', error);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
