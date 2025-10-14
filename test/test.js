const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

// Test colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🧪 Running Tests...\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`${colors.green}✓${colors.reset} ${test.name}`);
      } catch (error) {
        this.failed++;
        console.log(`${colors.red}✗${colors.reset} ${test.name}`);
        console.log(`  ${colors.red}${error.message}${colors.reset}`);
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${this.tests.length} | Passed: ${colors.green}${this.passed}${colors.reset} | Failed: ${colors.red}${this.failed}${colors.reset}`);
    console.log('='.repeat(50) + '\n');

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Create test runner
const runner = new TestRunner();

// Test: Check Node.js version
runner.test('Node.js version >= 14', () => {
  const version = process.version.match(/^v(\d+)/)[1];
  assert(parseInt(version) >= 14, `Node.js version ${process.version} is too old`);
});

// Test: Check required directories
runner.test('Required directories exist', async () => {
  const dirs = ['uploads', 'output', 'temp', 'logs'];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      throw new Error(`Directory '${dir}' does not exist`);
    }
  }
});

// Test: Check package.json
runner.test('package.json is valid', async () => {
  try {
    const pkg = require('../package.json');
    assert(pkg.name, 'Package name is missing');
    assert(pkg.version, 'Package version is missing');
    assert(pkg.dependencies, 'Dependencies are missing');
  } catch (error) {
    throw new Error('package.json is invalid or missing');
  }
});

// Test: Check required modules
runner.test('Required npm packages installed', () => {
  const required = [
    'express',
    'ejs',
    'tesseract.js',
    'translate',
    'pdf-parse',
    'pdf2pic'
  ];

  for (const module of required) {
    try {
      require.resolve(module);
    } catch {
      throw new Error(`Module '${module}' is not installed`);
    }
  }
});

// Test: Check configuration
runner.test('Configuration module loads', () => {
  try {
    const config = require('../config/config');
    assert(config.server, 'Server config missing');
    assert(config.upload, 'Upload config missing');
    assert(config.ocr, 'OCR config missing');
  } catch (error) {
    throw new Error(`Config error: ${error.message}`);
  }
});

// Test: Check logger
runner.test('Logger module loads', () => {
  try {
    const logger = require('../utils/logger');
    assert(typeof logger.info === 'function', 'Logger.info not a function');
    assert(typeof logger.error === 'function', 'Logger.error not a function');
  } catch (error) {
    throw new Error(`Logger error: ${error.message}`);
  }
});

// Test: Check OCR module
runner.test('OCR module loads', () => {
  try {
    const ocr = require('../modules/ocr');
    assert(typeof ocr.initialize === 'function', 'OCR.initialize not found');
    assert(typeof ocr.processPdf === 'function', 'OCR.processPdf not found');
  } catch (error) {
    throw new Error(`OCR module error: ${error.message}`);
  }
});

// Test: Check translator module
runner.test('Translator module loads', () => {
  try {
    const translator = require('../modules/translator');
    assert(typeof translator.translateToEnglish === 'function', 'translateToEnglish not found');
    assert(typeof translator.isOdiaText === 'function', 'isOdiaText not found');
  } catch (error) {
    throw new Error(`Translator error: ${error.message}`);
  }
});

// Test: Check parser module
runner.test('Parser module loads', () => {
  try {
    const parser = require('../modules/parser');
    assert(typeof parser.parseElectoralRoll === 'function', 'parseElectoralRoll not found');
  } catch (error) {
    throw new Error(`Parser error: ${error.message}`);
  }
});

// Test: Check environment variables
runner.test('Environment configured', () => {
  const requiredEnv = ['PORT'];
  
  for (const env of requiredEnv) {
    if (!process.env[env]) {
      console.warn(`  ${colors.yellow}Warning: ${env} not set, using default${colors.reset}`);
    }
  }
  
  // This test always passes but shows warnings
  assert(true);
});

// Test: Tesseract availability (optional but recommended)
runner.test('Tesseract check', async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync('tesseract --version');
    assert(stdout.includes('tesseract'), 'Tesseract not found');
    console.log(`  Found: ${stdout.split('\n')[0]}`);
  } catch (error) {
    throw new Error('Tesseract not installed or not in PATH');
  }
});

// Test: Write permissions
runner.test('Write permissions', async () => {
  const testFile = path.join('temp', 'test-write.txt');
  
  try {
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
  } catch (error) {
    throw new Error('No write permission in temp directory');
  }
});

// Run all tests
runner.run().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});