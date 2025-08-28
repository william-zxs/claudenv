/**
 * ccenv 国际化支持模块
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 支持的语言
const SUPPORTED_LANGUAGES = ['zh', 'en'];
const DEFAULT_LANGUAGE = 'zh';

// 语言资源缓存
let languageCache = {};
let currentLanguage = null;

/**
 * 检测系统语言
 */
function detectSystemLanguage() {
  const lang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES || '';
  
  // 提取语言代码 (例如: zh_CN.UTF-8 -> zh, en_US.UTF-8 -> en)
  const langCode = lang.split('_')[0].split('.')[0].toLowerCase();
  
  // 检查是否为支持的语言
  if (SUPPORTED_LANGUAGES.includes(langCode)) {
    return langCode;
  }
  
  // 默认返回中文
  return DEFAULT_LANGUAGE;
}

/**
 * 从配置文件读取语言设置
 */
function getLanguageFromConfig() {
  try {
    const CONFIG_DIR = path.join(os.homedir(), '.ccenv');
    const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
    
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (config.language && SUPPORTED_LANGUAGES.includes(config.language)) {
        return config.language;
      }
    }
  } catch (error) {
    // 忽略配置文件读取错误
  }
  return null;
}

/**
 * 确定当前应使用的语言
 */
function getCurrentLanguage() {
  if (currentLanguage) {
    return currentLanguage;
  }
  
  // 优先级: 环境变量 > 配置文件 > 系统语言 > 默认语言
  const envLang = process.env.CCENV_LANG;
  if (envLang && SUPPORTED_LANGUAGES.includes(envLang)) {
    currentLanguage = envLang;
    return currentLanguage;
  }
  
  const configLang = getLanguageFromConfig();
  if (configLang) {
    currentLanguage = configLang;
    return currentLanguage;
  }
  
  currentLanguage = detectSystemLanguage();
  return currentLanguage;
}

/**
 * 加载语言资源文件
 */
function loadLanguageResource(lang) {
  if (languageCache[lang]) {
    return languageCache[lang];
  }
  
  try {
    const resourceFile = path.join(__dirname, 'locales', `${lang}.json`);
    if (fs.existsSync(resourceFile)) {
      const resource = JSON.parse(fs.readFileSync(resourceFile, 'utf8'));
      languageCache[lang] = resource;
      return resource;
    }
  } catch (error) {
    console.error(`Error loading language resource for ${lang}:`, error.message);
  }
  
  // 如果加载失败，返回空对象
  languageCache[lang] = {};
  return languageCache[lang];
}

/**
 * 获取本地化字符串
 * @param {string} key - 消息键
 * @param {object} params - 参数对象，用于字符串插值
 * @returns {string} 本地化后的字符串
 */
function t(key, params = {}) {
  const lang = getCurrentLanguage();
  const resource = loadLanguageResource(lang);
  
  let message = resource[key];
  
  // 如果当前语言没有找到消息，尝试默认语言
  if (!message && lang !== DEFAULT_LANGUAGE) {
    const defaultResource = loadLanguageResource(DEFAULT_LANGUAGE);
    message = defaultResource[key];
  }
  
  // 如果仍然没有找到，返回键本身
  if (!message) {
    message = key;
  }
  
  // 执行参数替换 {{param}} -> value
  return message.replace(/\{\{(\w+)\}\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
}

/**
 * 设置当前语言
 */
function setLanguage(lang) {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    currentLanguage = lang;
    return true;
  }
  return false;
}

/**
 * 获取支持的语言列表
 */
function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * 保存语言设置到配置文件
 */
function saveLanguageToConfig(lang) {
  try {
    const CONFIG_DIR = path.join(os.homedir(), '.ccenv');
    const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
    
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    let config = {};
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    
    config.language = lang;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving language to config:', error.message);
    return false;
  }
}

module.exports = {
  t,
  setLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  saveLanguageToConfig,
  detectSystemLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};