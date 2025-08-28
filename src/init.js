#!/usr/bin/env node

/**
 * ccenv 初始化脚本
 * 在 npm install 后自动运行，创建配置目录和默认配置文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getShellTemplate, detectShell } = require('./shell-templates');
const { t } = require('./i18n');

// 配置文件路径
const os = require('os');
const CONFIG_DIR = path.join(os.homedir(), '.ccenv');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

// 默认配置内容
const DEFAULT_CONFIG = {
  defaultProfile: null,
  profiles: [
    {
      name: "kimi",
      env: {
        ANTHROPIC_BASE_URL: "https://api.moonshot.cn/anthropic",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "kimi-k2-turbo-preview",
        ANTHROPIC_SMALL_FAST_MODEL: "kimi-k2-turbo-preview"
      }
    },
    {
      name: "glm",
      env: {
        ANTHROPIC_BASE_URL: "https://open.bigmodel.cn/api/anthropic",
        ANTHROPIC_AUTH_TOKEN: ""
      }
    },
    {
      name: "qwen",
      env: {
        ANTHROPIC_BASE_URL: "https://dashscope.aliyuncs.com/api/v2/apps/claude-code-proxy",
        ANTHROPIC_AUTH_TOKEN: ""
      }
    },
    {
      name: "deepseek",
      env: {
        ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "deepseek-chat",
        ANTHROPIC_SMALL_FAST_MODEL: "deepseek-chat"
      }
    }
  ]
};

/**
 * 创建目录（如果不存在）
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// detectShell 函数现在从 shell-templates.js 导入

/**
 * 获取 shell 配置文件路径
 */
function getShellConfigFile(shellType) {
  const homeDir = os.homedir();
  
  switch (shellType) {
    case 'zsh':
      // 优先使用 .zshrc，如果不存在则使用 .zprofile
      const zshrc = path.join(homeDir, '.zshrc');
      const zprofile = path.join(homeDir, '.zprofile');
      return fs.existsSync(zshrc) ? zshrc : zprofile;
    
    case 'bash':
      // 优先使用 .bashrc，如果不存在则使用 .bash_profile
      const bashrc = path.join(homeDir, '.bashrc');
      const bash_profile = path.join(homeDir, '.bash_profile');
      return fs.existsSync(bashrc) ? bashrc : bash_profile;
    
    case 'fish':
      const fishConfig = path.join(homeDir, '.config', 'fish', 'config.fish');
      // 确保 fish 配置目录存在
      const fishDir = path.dirname(fishConfig);
      if (!fs.existsSync(fishDir)) {
        fs.mkdirSync(fishDir, { recursive: true });
      }
      return fishConfig;
    
    default:
      return null;
  }
}

// generateShellFunction 函数现在从 shell-templates.js 获取

/**
 * 安装 shell 函数
 */
function installShellFunction() {
  try {
    const shellType = detectShell();
    const template = getShellTemplate(shellType);
    
    if (!template) {
      console.log(t('shell.template_unavailable'));
      return false;
    }
    
    const configFile = getShellConfigFile(shellType);
    if (!configFile) {
      console.log(t('shell.config_file_not_found', { shell: shellType }));
      return false;
    }
    
    // 检查是否已经安装了函数
    let existingContent = '';
    if (fs.existsSync(configFile)) {
      existingContent = fs.readFileSync(configFile, 'utf8');
      if (existingContent.includes('ccenv function for easy profile switching')) {
        console.log(t('shell.function_exists', { path: configFile }));
        return true;
      }
    }
    
    // 添加函数到配置文件
    const functionCode = `\n${template.comment}\n${template.function}\n`;
    fs.appendFileSync(configFile, functionCode);
    
    console.log(t('shell.function_installed', { path: configFile }));
    console.log(t('shell.function_instruction', { path: configFile }));
    
    return true;
    
  } catch (error) {
    console.log(t('shell.install_error', { message: error.message }));
    return false;
  }
}

/**
 * 初始化配置
 */
function init() {
  try {
    console.log(t('init.initializing'));
    
    // 创建配置目录
    if (!fs.existsSync(CONFIG_DIR)) {
      console.log(t('init.creating_config_dir', { path: CONFIG_DIR }));
      ensureDir(CONFIG_DIR);
    }
    
    // 创建默认配置文件
    if (!fs.existsSync(CONFIG_FILE)) {
      console.log(t('init.creating_config_file', { path: CONFIG_FILE }));
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      console.log(t('init.config_file_created'));
    } else {
      console.log(t('init.config_file_exists'));
    }
    
    // 安装 shell 函数
    console.log('\n' + t('init.installing_shell_function'));
    installShellFunction();
    
    console.log('\n' + t('init.completion_success'));
    console.log('');
    console.log(t('init.usage_title'));
    console.log(t('init.usage.ls'));
    console.log(t('init.usage.profile'));
    console.log(t('init.usage.help'));
    console.log('');
    console.log(t('init.config_location', { path: CONFIG_FILE }));
    console.log('');
    console.log(t('init.token_warning'));
    
  } catch (error) {
    console.error(t('init.failed', { message: error.message }));
    process.exit(1);
  }
}

// 运行初始化
if (require.main === module) {
  init();
}

module.exports = { init };