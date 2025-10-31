# Agentic Fashion Shopping Assistant

Full-stack conversational shopping concierge that helps users discover fashion products via natural language. Built with Next.js (frontend) and Express (backend) with Redis-powered preference storage, OpenAI-powered query parsing, and a mock Razorpay checkout flow.

## Project Structure

```
./
├── README.md
├── productData.json              # Mock catalog
├── frontend/                     # Next.js 14 app router UI
│   ├── app/
│   │   ├── components/
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ConversationSuggestions.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── VirtualTryOnModal.tsx
│   │   │   └── WishlistPanel.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── next.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
├── backend/
│   ├── index.js
│   ├── package.json
│   ├── .eslintrc.cjs
│   └── .env.example
└── utils/
    └── parseQuery.js             # LLM + heuristic query parsing helper
```

## Prerequisites

- Node.js 18+
- Redis instance (local Docker `redis:alpine` or hosted)
- OpenAI API key (optional, heuristics fallback works without it)
- Razorpay test credentials (for mock payment order creation)

## Backend Setup

```bash
cd backend
cp .env.example .env
# set REDIS_URL, OPENAI_API_KEY (optional), Razorpay keys
npm install
npm run start
```

The Express API starts at `http://localhost:4000` by default and exposes:

- `POST /api/chat` – conversational search endpoint using OpenAI+heuristics and Redis session intelligence
- `POST /api/feedback` – update like/dislike/save state per session
- `GET /api/wishlist` – fetch saved products for a session
- `GET /api/preferences` – inspect stored preference profile
- `POST /api/payment/create-order` – sample Razorpay order creation (test mode)
- `GET /health` – service health probe

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Environment variables:

| Key | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Override when deploying API elsewhere |

Visit `http://localhost:3000` to chat with the stylist, like/dislike items, open the virtual try-on mock, and manage wishlist entries (persisted to Redis and localStorage).

## Redis Preference Model

Session state (`session:{id}`) is persisted in Redis as JSON with fields:

```json
{
  "preferences": {
    "likedBrands": [],
    "likedProductIds": [],
    "dislikedProductIds": [],
    "savedProductIds": [],
    "colors": [],
    "materials": [],
    "priceRange": { "min": null, "max": null }
  },
  "history": [
    {
      "timestamp": "ISO",
      "userMessage": "Looking for beige sneakers under ₹2000",
      "filters": { "color": "beige", ... },
      "responseProductIds": ["prod-1006", ...]
    }
  ]
}
```

This is enriched on every query using both LLM extraction and heuristics, allowing ranked recommendations that respect likes/dislikes and known preferences.

## Query Parsing Helper

`utils/parseQuery.js` combines:

- Optional OpenAI `chat.completions` call (model configurable via `OPENAI_MODEL`)
- Regex heuristics for colors, categories, price ranges, sizes, and brands

If OpenAI fails or is not configured, heuristics still return structured filters.

## Razorpay Test Integration

1. Create test keys in Razorpay dashboard.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`.
3. Call `POST /api/payment/create-order` with `{ "amount": 2599, "currency": "INR" }` to receive an order payload.
4. Frontend can consume the order id to initialize Razorpay Checkout later.

## Sample Conversation

```
User: "Need a red khaadi kurta for men under ₹3000"
Assistant: Returns 4 curated kurtas in that budget, suggests filtering by fit or delivery speed.
User: Likes and saves one option -> preference profile stores color "red" and brand affinity.
User: "Show me casual sneakers to match"
Assistant: Reuses context, surfaces beige sneakers under ₹2000 with virtual try-on modal.
User: Proceeds to checkout via Razorpay test order.
```

## Testing & Quality

- `npm run lint` in both `frontend` and `backend`
- Backend validated with sample chat + wishlist flows (Redis required)
- Frontend Next.js build: `npm run build`

## Deployment

1. Build and test locally:
   ```bash
   cd backend && npm install && npm run lint && npm run start
   # new terminal
   cd frontend && npm install && npm run lint && npm run build
   ```
2. Deploy API to your preferred host (Fly, Railway, etc.). Ensure environment variables are set.
3. Deploy the Next.js frontend to Vercel with `NEXT_PUBLIC_BACKEND_URL` pointing to the hosted API.
4. Connect Redis & Razorpay secrets in the deployment platform.

Enjoy your agentic fashion concierge! ✨
