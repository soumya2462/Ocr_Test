const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.logFile = path.join(this.logDir, `app-${this.getDateString()}.log`);
    this.errorFile = path.join(this.logDir, `error-${this.getDateString()}.log`);
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };

    this.levels = {
      error: { priority: 0, color: 'red', emoji: '❌' },
      warn: { priority: 1, color: 'yellow', emoji: '⚠️' },
      info: { priority: 2, color: 'blue', emoji: 'ℹ️' },
      success: { priority: 3, color: 'green', emoji: '✅' },
      debug: { priority: 4, color: 'cyan', emoji: '🔍' }
    };

    this.currentLevel = process.env.LOG_LEVEL || 'info';
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getDateString() {
    const date = new Date();
    return date.toISOString().split('T')[0];
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data) {
    const timestamp = this.getTimestamp();
    const levelInfo = this.levels[level] || this.levels.info;
    
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        formattedMessage += '\n' + JSON.stringify(data, null, 2);
      } else {
        formattedMessage += ' ' + data;
      }
    }
    
    return formattedMessage;
  }

  shouldLog(level) {
    const currentPriority = this.levels[this.currentLevel]?.priority ?? 2;
    const messagePriority = this.levels[level]?.priority ?? 2;
    return messagePriority <= currentPriority;
  }

  writeToFile(filename, message) {
    try {
      fs.appendFileSync(filename, message + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const levelInfo = this.levels[level] || this.levels.info;
    const formattedMessage = this.formatMessage(level, message, data);

    // Console output with colors
    const colorCode = this.colors[levelInfo.color] || this.colors.reset;
    const consoleMessage = `${colorCode}${levelInfo.emoji} ${message}${this.colors.reset}`;
    
    if (data) {
      console.log(consoleMessage);
      if (typeof data === 'object') {
        console.log(data);
      } else {
        console.log(data);
      }
    } else {
      console.log(consoleMessage);
    }

    // Write to file
    this.writeToFile(this.logFile, formattedMessage);

    // Write errors to separate file
    if (level === 'error') {
      this.writeToFile(this.errorFile, formattedMessage);
    }
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  success(message, data = null) {
    this.log('success', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  // Special method for processing steps
  step(stepNumber, totalSteps, message) {
    const progress = `[${stepNumber}/${totalSteps}]`;
    this.info(`${progress} ${message}`);
  }

  // Method for progress bars
  progress(current, total, message = '') {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    const progressMsg = `${bar} ${percentage}% ${message}`;
    
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${this.colors.cyan}${progressMsg}${this.colors.reset}`);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  // Separate section with decorative lines
  section(title) {
    const line = '='.repeat(60);
    console.log(`\n${this.colors.cyan}${line}${this.colors.reset}`);
    console.log(`${this.colors.bright}${this.colors.cyan}${title}${this.colors.reset}`);
    console.log(`${this.colors.cyan}${line}${this.colors.reset}\n`);
  }

  // Table display
  table(data) {
    console.table(data);
  }

  // Clean old log files (keep last N days)
  cleanOldLogs(daysToKeep = 7) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.info(`Cleaned old log file: ${file}`);
        }
      });
    } catch (error) {
      this.error('Failed to clean old logs', error.message);
    }
  }

  // Export logs
  exportLogs(outputPath) {
    try {
      const logs = fs.readFileSync(this.logFile, 'utf8');
      fs.writeFileSync(outputPath, logs);
      this.success(`Logs exported to: ${outputPath}`);
      return true;
    } catch (error) {
      this.error('Failed to export logs', error.message);
      return false;
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Clean old logs on startup
logger.cleanOldLogs();

module.exports = logger;