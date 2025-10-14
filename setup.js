#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkTesseract() {
  log('\n📋 Checking Tesseract installation...', 'cyan');
  
  try {
    const { stdout } = await execAsync('tesseract --version');
    log('✅ Tesseract is installed', 'green');
    console.log(stdout.split('\n')[0]);
    
    // Check for Odia language support
    const { stdout: langs } = await execAsync('tesseract --list-langs');
    const hasOdia = langs.includes('ori');
    const hasEnglish = langs.includes('eng');
    
    if (hasOdia && hasEnglish) {
      log('✅ Odia and English language packs found', 'green');
    } else {
      log('⚠️  Warning: Missing language packs', 'yellow');
      if (!hasOdia) log('   - Odia (ori) not found', 'yellow');
      if (!hasEnglish) log('   - English (eng) not found', 'yellow');
      
      log('\n📦 Install language packs:', 'yellow');
      log('   Ubuntu/Debian: sudo apt-get install tesseract-ocr-ori tesseract-ocr-eng', 'yellow');
      log('   macOS: brew install tesseract-lang', 'yellow');
    }
    
    return true;
  } catch (error) {
    log('❌ Tesseract is not installed or not in PATH', 'red');
    log('\n📦 Installation instructions:', 'yellow');
    log('   Ubuntu/Debian: sudo apt-get install tesseract-ocr', 'yellow');
    log('   macOS: brew install tesseract', 'yellow');
    log('   Windows: https://github.com/UB-Mannheim/tesseract/wiki', 'yellow');
    return false;
  }
}

async function createDirectories() {
  log('\n📁 Creating project directories...', 'cyan');
  
  const directories = [
    'uploads',
    'output',
    'temp',
    'temp/images',
    'logs',
    'public',
    'public/css',
    'public/js'
  ];
  
  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      log(`✅ Created: ${dir}`, 'green');
    } catch (error) {
      if (error.code !== 'EEXIST') {
        log(`⚠️  Could not create ${dir}: ${error.message}`, 'yellow');
      }
    }
  }
  
  // Create .gitkeep files
  for (const dir of ['uploads', 'output', 'temp']) {
    try {
      await fs.writeFile(path.join(dir, '.gitkeep'), '');
    } catch (error) {
      // Ignore errors
    }
  }
}

async function createEnvFile() {
  log('\n⚙️  Setting up environment file...', 'cyan');
  
  const envPath = '.env';
  const envExamplePath = '.env.example';
  
  try {
    // Check if .env already exists
    await fs.access(envPath);
    log('✅ .env file already exists', 'green');
  } catch {
    // Copy from .env.example if it exists
    try {
      const envExample = await fs.readFile(envExamplePath, 'utf8');
      await fs.writeFile(envPath, envExample);
      log('✅ Created .env file from .env.example', 'green');
    } catch {
      // Create basic .env file
      const basicEnv = `# Server Configuration
PORT=3000
NODE_ENV=development

# File Upload Limits
MAX_FILE_SIZE=52428800

# Tesseract Configuration
TESSERACT_LANG=eng+ori

# Processing Options
ENABLE_TRANSLATION=true
OCR_CONFIDENCE_THRESHOLD=60
`;
      await fs.writeFile(envPath, basicEnv);
      log('✅ Created basic .env file', 'green');
    }
  }
}

async function checkDependencies() {
  log('\n📦 Checking Node.js dependencies...', 'cyan');
  
  try {
    const packageJson = require('./package.json');
    log(`✅ package.json found`, 'green');
    log(`   Project: ${packageJson.name}`, 'blue');
    log(`   Version: ${packageJson.version}`, 'blue');
    
    // Check if node_modules exists
    try {
      await fs.access('node_modules');
      log('✅ Dependencies appear to be installed', 'green');
    } catch {
      log('⚠️  Dependencies not installed', 'yellow');
      log('   Run: npm install', 'yellow');
    }
    
    return true;
  } catch (error) {
    log('❌ package.json not found', 'red');
    return false;
  }
}

async function testConfiguration() {
  log('\n🧪 Testing configuration...', 'cyan');
  
  // Test if all required modules can be loaded
  const modules = [
    { name: 'express', file: 'express' },
    { name: 'tesseract.js', file: 'tesseract.js' },
    { name: 'translate', file: 'translate' },
    { name: 'pdf-parse', file: 'pdf-parse' },
    { name: 'pdf2pic', file: 'pdf2pic' }
  ];
  
  let allModulesOk = true;
  
  for (const module of modules) {
    try {
      require(module.file);
      log(`✅ ${module.name}`, 'green');
    } catch (error) {
      log(`❌ ${module.name} - not installed`, 'red');
      allModulesOk = false;
    }
  }
  
  if (!allModulesOk) {
    log('\n⚠️  Some dependencies are missing. Run: npm install', 'yellow');
  }
  
  return allModulesOk;
}

async function createReadme() {
  log('\n📄 Checking README.md...', 'cyan');
  
  try {
    await fs.access('README.md');
    log('✅ README.md exists', 'green');
  } catch {
    log('⚠️  README.md not found', 'yellow');
  }
}

async function displayStartupInstructions() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🎉 Setup Complete!', 'green');
  log('='.repeat(60), 'cyan');
  
  log('\n📋 Next steps:', 'blue');
  log('   1. Install dependencies (if not done):', 'blue');
  log('      npm install', 'cyan');
  
  log('\n   2. Start the development server:', 'blue');
  log('      npm run dev', 'cyan');
  log('      or', 'blue');
  log('      npm start', 'cyan');
  
  log('\n   3. Open your browser:', 'blue');
  log('      http://localhost:3000', 'cyan');
  
  log('\n   4. Upload a PDF and start processing!', 'blue');
  
  log('\n📚 Documentation:', 'blue');
  log('   - See README.md for detailed instructions', 'blue');
  log('   - Check .env file for configuration options', 'blue');
  
  log('\n💡 Tips:', 'yellow');
  log('   - Test with small PDFs first (1-5 pages)', 'yellow');
  log('   - Processing takes 5-10 minutes for large files', 'yellow');
  log('   - Check logs/ directory for detailed logs', 'yellow');
  
  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

async function main() {
  console.clear();
  log('╔════════════════════════════════════════════════╗', 'cyan');
  log('║   Electoral Roll Processor - Setup Script     ║', 'cyan');
  log('╚════════════════════════════════════════════════╝', 'cyan');
  
  try {
    // Run all setup tasks
    const tesseractOk = await checkTesseract();
    await createDirectories();
    await createEnvFile();
    const depsOk = await checkDependencies();
    
    // Only test if dependencies are installed
    if (depsOk) {
      await testConfiguration();
    }
    
    await createReadme();
    
    // Display final instructions
    await displayStartupInstructions();
    
    if (!tesseractOk) {
      log('⚠️  IMPORTANT: Install Tesseract OCR before running the application', 'red');
      process.exit(1);
    }
    
    log('✅ Setup completed successfully!', 'green');
    process.exit(0);
    
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    log(error.stack, 'red');
    process.exit(1);
  }
}

// Run setup if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };