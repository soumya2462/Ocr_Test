require('dotenv').config();
const path = require('path');

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost'
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800, // 50MB
    allowedTypes: ['application/pdf'],
    uploadDir: path.join(__dirname, '../uploads'),
    tempDir: path.join(__dirname, '../temp'),
    outputDir: path.join(__dirname, '../output')
  },

  // Tesseract OCR Configuration
  ocr: {
    language: process.env.TESSERACT_LANG || 'eng+ori',
    confidenceThreshold: parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 60,
    psmMode: 3, // Fully automatic page segmentation
    oem: 3, // Default OCR Engine Mode
    dpi: 300
  },

  // PDF Conversion Settings
  pdfConversion: {
    density: 300,
    format: 'png',
    width: 2480,
    height: 3508,
    quality: 100
  },

  // Translation Configuration
  translation: {
    enabled: process.env.ENABLE_TRANSLATION === 'true',
    sourceLanguage: 'or', // Odia
    targetLanguage: 'en', // English
    delayMs: parseInt(process.env.TRANSLATION_DELAY_MS) || 100,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_TRANSLATIONS) || 5,
    engine: 'google', // or 'libre'
    libreTranslateUrl: process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableDebug: process.env.ENABLE_DEBUG === 'true',
    logDir: path.join(__dirname, '../logs'),
    maxLogSize: '10m',
    maxFiles: 5
  },

  // Processing Configuration
  processing: {
    timeout: 600000, // 10 minutes
    retryAttempts: 3,
    retryDelay: 5000,
    enableCache: true,
    cacheDir: path.join(__dirname, '../cache')
  },

  // Security Configuration
  security: {
    enableCors: true,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    enableRateLimiting: true,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100 // requests per window
  },

  // Application Metadata
  app: {
    name: 'Electoral Roll Processor',
    version: '1.0.0',
    description: 'Process electoral roll PDFs with OCR and translation',
    author: 'Your Name'
  }
};

// Validation function
function validateConfig() {
  const errors = [];

  // Validate port
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid port number');
  }

  // Validate file size
  if (config.upload.maxFileSize < 1024) {
    errors.push('Max file size too small');
  }

  // Validate OCR settings
  if (config.ocr.confidenceThreshold < 0 || config.ocr.confidenceThreshold > 100) {
    errors.push('OCR confidence threshold must be between 0 and 100');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

// Get configuration value by path
function get(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

// Set configuration value
function set(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((obj, key) => obj[key], config);
  target[lastKey] = value;
}

// Display configuration
function display() {
  console.log('\n📋 Current Configuration:');
  console.log('========================');
  console.log(`Environment: ${config.server.env}`);
  console.log(`Port: ${config.server.port}`);
  console.log(`Upload Dir: ${config.upload.uploadDir}`);
  console.log(`Output Dir: ${config.upload.outputDir}`);
  console.log(`OCR Language: ${config.ocr.language}`);
  console.log(`Translation: ${config.translation.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Log Level: ${config.logging.level}`);
  console.log('========================\n');
}

// Validate on load
try {
  validateConfig();
} catch (error) {
  console.error('❌ Configuration Error:', error.message);
  process.exit(1);
}

module.exports = {
  ...config,
  get,
  set,
  display,
  validateConfig
};