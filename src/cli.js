#!/usr/bin/env node

/**
 * ccenv - 便捷切换 Claude API 配置的命令行工具
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { t, setLanguage, getSupportedLanguages, saveLanguageToConfig } = require('./i18n');

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.ccenv');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

/**
 * ANSI 颜色辅助函数
 */
function colorGreen(text) {
  return `\x1b[32m${text}\x1b[0m`;
}

function colorRed(text) {
  return `\x1b[31m${text}\x1b[0m`;
}

/**
 * 检查配置文件是否存在
 */
function checkConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(t('error.config_file_not_found', { path: CONFIG_FILE }));
    console.error(t('error.install_script_required'));
    process.exit(1);
  }
}

/**
 * 读取配置文件
 */
function readConfig() {
  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error(t('error.cannot_read_config', { message: error.message }));
    process.exit(1);
  }
}

/**
 * 获取当前生效的配置
 */
function getCurrentProfile(config) {
  const currentProfileName = process.env.CCENV_PROFILE;
  if (!currentProfileName) return null;
  
  return config.profiles.find(profile => profile.name === currentProfileName);
}

/**
 * 根据名称获取配置
 */
function getProfileConfig(config, profileName) {
  return config.profiles.find(profile => profile.name === profileName);
}

/**
 * 获取默认配置名称
 */
function getDefaultProfile(config) {
  return config.defaultProfile;
}

/**
 * 设置默认配置
 */
function setDefaultProfile(profileName) {
  const config = readConfig();
  
  // 验证配置名称是否存在
  if (!getProfileConfig(config, profileName)) {
    console.error(t('error.profile_not_found', { profile: profileName }));
    process.exit(1);
  }
  
  // 更新默认配置
  config.defaultProfile = profileName;
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.error(t('success.default_profile_set', { profile: profileName }));
  } catch (error) {
    console.error(t('error.cannot_save_config', { message: error.message }));
    process.exit(1);
  }
}

/**
 * 显示默认配置信息
 */
function showDefaultProfile() {
  const config = readConfig();
  const defaultProfile = getDefaultProfile(config);
  
  if (defaultProfile) {
    console.error(t('info.current_default_profile', { profile: defaultProfile }));
  } else {
    console.error(t('info.no_default_profile'));
  }
}

/**
 * 写入配置文件的安全函数
 */
function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error(t('error.cannot_save_config', { message: error.message }));
    return false;
  }
}

/**
 * 生成环境变量设置的 shell 命令
 */
function generateEnvCommands(profile) {
  const commands = [];
  
  // 清除现有环境变量
  const envVars = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'CCENV_PROFILE'];
  envVars.forEach(varName => {
    commands.push(`unset ${varName}`);
  });
  
  // 设置 CCENV_PROFILE 环境变量
  commands.push(`export CCENV_PROFILE="${profile.name}"`);
  
  // 设置新环境变量
  if (profile.env) {
    Object.entries(profile.env).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        // 确保值是字符串类型
        const stringValue = String(value);
        if (stringValue.trim()) {
          commands.push(`export ${key}="${stringValue}"`);
        }
      }
    });
  }
  
  return commands.join('\n');
}

/**
 * 应用配置（输出环境变量设置命令）
 */
function applyProfile(config, profileName) {
  const profile = getProfileConfig(config, profileName);
  
  if (!profile) {
    console.error(t('error.profile_not_found', { profile: profileName }));
    process.exit(1);
  }
  
  // 输出环境变量设置命令
  console.log(generateEnvCommands(profile));
  
  // 输出确认消息到 stderr，这样不会影响 eval
  console.error(t('success.switched_to_profile', { profile: profileName }));
}

/**
 * 自动应用默认配置（如果没有设置环境变量且有默认配置）
 */
function autoApplyDefaultProfile() {
  const config = readConfig();
  const defaultProfile = getDefaultProfile(config);
  
  // 如果没有默认配置，输出空的命令
  if (!defaultProfile) {
    return;
  }
  
  // 如果当前没有设置 CCENV_PROFILE，则应用默认配置
  if (!process.env.CCENV_PROFILE) {
    const profile = getProfileConfig(config, defaultProfile);
    if (profile) {
      console.log(generateEnvCommands(profile));
      console.error(t('success.auto_applied_default', { profile: defaultProfile }));
    }
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  const supportedLanguages = getSupportedLanguages().join(', ');
  console.error(t('help.usage'));
  console.error('');
  console.error(t('help.commands'));
  console.error(t('help.cmd.ls'));
  console.error(t('help.cmd.use'));
  console.error(t('help.cmd.default'));
  console.error(t('help.cmd.default_set'));
  console.error(t('help.cmd.edit'));
  console.error(t('help.cmd.lang'));
  console.error('');
  console.error(t('help.options'));
  console.error(t('help.opt.help'));
  console.error(t('help.opt.version'));
  console.error(t('help.opt.lang'));
  console.error('');
  console.error(t('help.description'));
  console.error(t('help.desc.default_config'));
  console.error(t('help.desc.supported_langs', { languages: supportedLanguages }));
}

/**
 * 列出所有配置
 */
function listProfiles() {
  const config = readConfig();
  const currentProfile = getCurrentProfile(config);
  const defaultProfile = getDefaultProfile(config);
  
  console.error(t('info.available_configs'));
  config.profiles.forEach(profile => {
    const current = currentProfile && currentProfile.name === profile.name ? '*' : ' ';
    const isDefault = defaultProfile === profile.name ? t('info.default_marker') : '';
    const baseUrl = profile.env?.ANTHROPIC_BASE_URL || 'N/A';
    const hasToken = profile.env?.ANTHROPIC_AUTH_TOKEN && String(profile.env.ANTHROPIC_AUTH_TOKEN).trim();
    const tokenStatus = hasToken ? colorGreen(t('label.token_configured')) : colorRed(t('label.token_missing'));
    console.error(`${current} ${profile.name}${isDefault} - ${baseUrl} ${tokenStatus}`);
  });
  console.error('');
  const greenToken = colorGreen(t('label.token_configured'));
  const redToken = colorRed(t('label.token_missing'));
  console.error(t('info.status_legend', { green: greenToken, red: redToken }));
  console.error(t('info.usage_instruction'));
}

/**
 * 显示版本信息
 */
function showVersion() {
  const packageJson = require('../package.json');
  console.error(t('version.ccenv', { version: packageJson.version }));
}

/**
 * 编辑配置文件
 */
function editConfig() {
  checkConfigFile();
  
  // 检查是否在 TTY 环境中
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error(t('error.edit_requires_tty'));
    console.error(t('error.edit_tty_hint'));
    process.exit(1);
  }
  
  // 编辑器优先级：vim -> vi
  const editors = ['vim', 'vi'];
  
  function tryEditor(index) {
    if (index >= editors.length) {
      console.error(t('error.no_editor_found'));
      console.error(t('error.edit_hint', { path: CONFIG_FILE }));
      process.exit(1);
    }
    
    const editor = editors[index];
    console.error(t('info.editor_opening', { editor }));
    
    const editorProcess = spawn(editor, [CONFIG_FILE], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TERM: process.env.TERM || 'xterm-256color'
      },
      cwd: process.cwd()
    });
    
    editorProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        // 编辑器不存在，尝试下一个
        console.error(t('info.editor_unavailable', { editor }));
        tryEditor(index + 1);
      } else {
        console.error(t('error.editor_start_failed', { message: error.message }));
        process.exit(1);
      }
    });
    
    editorProcess.on('exit', (code) => {
      if (code === 0) {
        console.error(t('success.editor_completed'));
      } else if (code !== null) {
        console.error(t('info.editor_exit_code', { code }));
      }
      // 正常结束程序，不要让 Node.js 继续运行
      process.exit(code || 0);
    });
  }
  
  tryEditor(0);
}

/**
 * 主函数
 */
/**
 * 显示或设置语言
 */
function handleLanguage(langCode) {
  if (!langCode) {
    // 显示当前语言
    const currentLang = require('./i18n').getCurrentLanguage();
    const langName = currentLang === 'zh' ? '中文' : 'English';
    console.error(t('lang.current_language', { language: langName }));
    return;
  }
  
  if (setLanguage(langCode)) {
    const langName = langCode === 'zh' ? '中文' : 'English';
    console.error(t('lang.language_set', { language: langName }));
    
    // 保存语言设置到配置文件
    if (!saveLanguageToConfig(langCode)) {
      console.error(t('lang.save_failed'));
    }
  } else {
    console.error(t('lang.unsupported_language', { language: langCode }));
    console.error(t('lang.supported_languages', { languages: getSupportedLanguages().join(', ') }));
    process.exit(1);
  }
}

function main() {
  // 检查是否有 --lang 参数
  let langIndex = process.argv.findIndex(arg => arg === '--lang');
  if (langIndex !== -1 && process.argv[langIndex + 1]) {
    setLanguage(process.argv[langIndex + 1]);
    // 移除 --lang 参数
    process.argv.splice(langIndex, 2);
  }
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 检查配置文件
    checkConfigFile();
    listProfiles();
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case '-h':
    case '--help':
      showHelp();
      return;
    case '-v':
    case '--version':
      showVersion();
      return;
    case 'ls':
      // 检查配置文件
      checkConfigFile();
      listProfiles();
      return;
    case 'edit':
      editConfig();
      return;
    case 'e':
      editConfig();
      return;
    case 'use':
    case 'u':
      if (args.length < 2) {
        console.error(t('error.command_requires_profile', { command }));
        console.error(t('error.command_usage', { command }));
        process.exit(1);
      }
      // 检查配置文件
      checkConfigFile();
      // 应用指定配置
      const config = readConfig();
      applyProfile(config, args[1]);
      return;
    case 'default':
      // 检查配置文件
      checkConfigFile();
      if (args.length < 2) {
        // 显示当前默认配置
        showDefaultProfile();
      } else {
        // 设置默认配置
        setDefaultProfile(args[1]);
      }
      return;
    case '--auto-apply-default':
      // 内部命令：自动应用默认配置
      checkConfigFile();
      autoApplyDefaultProfile();
      return;
    case 'lang':
      // 检查配置文件
      checkConfigFile();
      handleLanguage(args[1]);
      return;
    default:
      // 检查是否直接指定配置名称
      checkConfigFile();
      const configForProfile = readConfig();
      if (getProfileConfig(configForProfile, command)) {
        applyProfile(configForProfile, command);
        return;
      }
      
      console.error(t('error.unknown_command', { command }));
      console.error('');
      showHelp();
      process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(t('error.program_execution', { message: error.message }));
    process.exit(1);
  }
}

module.exports = { main, applyProfile, generateEnvCommands };