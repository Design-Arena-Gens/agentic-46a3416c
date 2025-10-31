const axios = require('axios');

const COLOR_KEYWORDS = [
  'red',
  'blue',
  'beige',
  'black',
  'white',
  'green',
  'olive',
  'ivory',
  'teal',
  'saffron',
  'pink',
  'yellow',
  'orange',
  'brown'
];

const CATEGORY_KEYWORDS = [
  'kurta',
  'sneakers',
  'shoes',
  'shirt',
  'pants',
  'jeans',
  'saree',
  'dress',
  'top',
  'jacket'
];

const MATERIAL_KEYWORDS = [
  'cotton',
  'linen',
  'khaadi',
  'khadi',
  'silk',
  'denim',
  'modal',
  'suede',
  'mesh',
  'leather',
  'knit',
  'chanderi'
];

const GENDER_KEYWORDS = {
  men: ['men', 'male', 'guy'],
  women: ['women', 'female', 'woman', 'lady'],
  unisex: ['unisex']
};

const SIZE_REGEX = /(xxl|xl|xs|s|m|l|uk\d+)/gi;
const PRICE_REGEX = /(under|below|less than|upto|up to|maximum|max)\s*₹?\s*(\d+)/i;
const PRICE_RANGE_REGEX = /₹?\s*(\d{3,5})\s*(to|-)\s*₹?\s*(\d{3,5})/i;

const extractNumber = (value) => {
  const match = value && value.match(/\d+/);
  return match ? parseInt(match[0], 10) : undefined;
};

const findKeyword = (text, keywords) => {
  const lower = text.toLowerCase();
  const found = keywords.find((keyword) => lower.includes(keyword));
  return found || undefined;
};

const detectGender = (text) => {
  const lower = text.toLowerCase();
  for (const [gender, matches] of Object.entries(GENDER_KEYWORDS)) {
    if (matches.some((word) => lower.includes(word))) {
      return gender;
    }
  }
  return undefined;
};

const heuristicParse = (message) => {
  const lower = message.toLowerCase();

  const priceRangeMatch = lower.match(PRICE_RANGE_REGEX);
  const maxPriceMatch = lower.match(PRICE_REGEX);

  const budget = priceRangeMatch
    ? {
        min: extractNumber(priceRangeMatch[1]),
        max: extractNumber(priceRangeMatch[3])
      }
    : maxPriceMatch
    ? {
        min: undefined,
        max: extractNumber(maxPriceMatch[2])
      }
    : undefined;

  const filters = {
    color: findKeyword(lower, COLOR_KEYWORDS),
    category: findKeyword(lower, CATEGORY_KEYWORDS),
    material: findKeyword(lower, MATERIAL_KEYWORDS),
    size: lower.match(SIZE_REGEX)?.map((size) => size.toUpperCase()),
    gender: detectGender(lower),
    budget,
    brand: undefined
  };

  const brandMatch = lower.match(/by ([a-z0-9\s]+)/i);
  if (brandMatch) {
    filters.brand = brandMatch[1].trim();
  }

  const quantityMatch = lower.match(/(\d+)\s*(options|choices|pairs|items)/i);

  return {
    filters,
    meta: {
      quantity: quantityMatch ? parseInt(quantityMatch[1], 10) : undefined
    }
  };
};

const callOpenAI = async (message, instructions) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: instructions
          },
          {
            role: 'user',
            content: message
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      return undefined;
    }

    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('OpenAI parse failed, falling back to heuristics', error.message);
    return undefined;
  }
};

const SYSTEM_PROMPT = `You are an AI stylist assistant.
Return a compact JSON object with product filters extracted from the user query.
Format: {"filters": {"category": string|null, "color": string|null, "material": string|null, "gender": string|null, "brand": string|null, "budget": {"min": number|null, "max": number|null}|null, "size": string[]|null}, "meta": {"quantity": number|null}}
Use lowercase values.
Only respond with valid JSON.`;

async function parseQuery(message) {
  const llmResult = await callOpenAI(message, SYSTEM_PROMPT);
  if (llmResult) {
    const heuristic = heuristicParse(message);
    return {
      filters: llmResult.filters ?? heuristic.filters,
      meta: llmResult.meta ?? heuristic.meta
    };
  }
  return heuristicParse(message);
}

module.exports = {
  parseQuery
};
