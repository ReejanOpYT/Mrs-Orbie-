export const PREFIX = process.env.BOT_PREFIX || '$';
export const BOT_NAME = (process.env.Bot_Name || process.env.BOT_NAME || 'Mrs Orbie').trim() || 'Mrs Orbie';
export const BOT_DISPLAY = `${BOT_NAME} • Quest Assistant`;

// Centralized branding/theme configuration. Change these in .env without editing source.
export const SUPPORT_SERVER_URL = (process.env.SUPPORT_SERVER_URL || 'https://discord.gg/jBv4rU75').trim();
export const SUPPORT_SERVER_NAME = (process.env.SUPPORT_SERVER_NAME || 'Mrs Orbie Support').trim();
export const BOT_DESCRIPTION = (process.env.BOT_DESCRIPTION || 'Your cute Quest Assistant').trim();
export const DEVELOPER_NAME = (process.env.DEVELOPER_NAME || 'ReejanOpYT').trim();

export const THEME = (process.env.THEME || 'pink').trim().toLowerCase();
export const THEME_PRIMARY = process.env.THEME_PRIMARY || '#ff69b4';
export const THEME_SECONDARY = process.env.THEME_SECONDARY || '#ff9ed2';
export const THEME_BACKGROUND = process.env.THEME_BACKGROUND || '#0f0f14';
export const THEME_CARD = process.env.THEME_CARD || '#181820';
export const THEME_CARD_SECONDARY = process.env.THEME_CARD_SECONDARY || '#20202b';
export const THEME_TEXT = process.env.THEME_TEXT || '#ffffff';
export const THEME_MUTED = process.env.THEME_MUTED || '#a9a9b3';
export const THEME_SUCCESS = process.env.THEME_SUCCESS || '#57f287';
export const THEME_WARNING = process.env.THEME_WARNING || '#fee75c';
export const THEME_ERROR = process.env.THEME_ERROR || '#ed4245';
export const DASHBOARD_NAME = (process.env.DASHBOARD_NAME || `${BOT_NAME} Dashboard`).trim();
export const DASHBOARD_URL = (process.env.DASHBOARD_URL || '').trim();
