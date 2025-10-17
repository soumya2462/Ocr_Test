// const translate = require('translate');
const fs = require('fs').promises;

// translate.engine = 'google';

class Translator {
  constructor() {
    this.cache = new Map();
    this.lastRequestTime = 0;
    this.minRequestInterval = 300; // 300ms between requests
  }

  isOdiaText(text) {
    return /[\u0B00-\u0B7F]/.test(text);
  }

  normalizeText(text) {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u0B00-\u0B7F-]/g, '');
  }

  async translateToEnglish(text) {
    const translate = await import('translate');
    translate.engine = 'google';
    if (!text || text.trim() === '') return '';

    const normalizedText = this.normalizeText(text);

    if (this.cache.has(normalizedText)) {
      return this.cache.get(normalizedText);
    }

    if (!this.isOdiaText(normalizedText)) {
      return normalizedText;
    }

    if (normalizedText.length < 3) {
      return normalizedText;
    }

    try {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await this.delay(this.minRequestInterval - timeSinceLastRequest);
      }

      console.log(`🌐 Translating: ${normalizedText.substring(0, 40)}...`);
      
      const result = await translate(normalizedText, {
        from: 'or',
        to: 'en'
      });

      this.lastRequestTime = Date.now();
      this.cache.set(normalizedText, result);
      
      return result;
    } catch (error) {
      console.error('Translation error:', error.message);
      return this.romanizeOdia(normalizedText);
    }
  }

  romanizeOdia(text) {
    const map = {
      'କ': 'ka', 'ଖ': 'kha', 'ଗ': 'ga', 'ଘ': 'gha', 'ଙ': 'nga',
      'ଚ': 'cha', 'ଛ': 'chha', 'ଜ': 'ja', 'ଝ': 'jha', 'ଞ': 'nya',
      'ଟ': 'ta', 'ଠ': 'tha', 'ଡ': 'da', 'ଢ': 'dha', 'ଣ': 'na',
      'ତ': 'ta', 'ଥ': 'tha', 'ଦ': 'da', 'ଧ': 'dha', 'ନ': 'na',
      'ପ': 'pa', 'ଫ': 'pha', 'ବ': 'ba', 'ଭ': 'bha', 'ମ': 'ma',
      'ଯ': 'ya', 'ର': 'ra', 'ଲ': 'la', 'ଳ': 'la', 'ଶ': 'sha',
      'ଷ': 'sha', 'ସ': 'sa', 'ହ': 'ha', 'ା': 'a', 'ି': 'i',
      'ୀ': 'i', 'ୁ': 'u', 'ୂ': 'u', 'େ': 'e', 'ୈ': 'ai',
      'ୋ': 'o', 'ୌ': 'au', 'ଂ': 'm', 'ଃ': 'h', '୍': '',
      'ଅ': 'a', 'ଆ': 'a', 'ଇ': 'i', 'ଈ': 'i', 'ଉ': 'u',
      'ଊ': 'u', 'ଏ': 'e', 'ଐ': 'ai', 'ଓ': 'o', 'ଔ': 'au'
    };

    let result = '';
    for (let char of text) {
      result += map[char] || char;
    }
    
    return this.capitalizeWords(result);
  }

  capitalizeWords(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 Translation cache cleared');
  }

  async saveCache(filepath) {
    try {
      const cacheData = Array.from(this.cache.entries());
      await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cache saved: ${this.cache.size} entries`);
    } catch (error) {
      console.error('Error saving cache:', error.message);
    }
  }

  async loadCache(filepath) {
    try {
      const data = await fs.readFile(filepath, 'utf8');
      const cacheData = JSON.parse(data);
      this.cache = new Map(cacheData);
      console.log(`📥 Cache loaded: ${this.cache.size} entries`);
    } catch (error) {
      console.log('No cache file found, starting fresh');
    }
  }
}

module.exports = new Translator();