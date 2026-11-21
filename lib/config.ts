// App-wide settings in one place.

export const APP_NAME = "Dream Journal";

/** Which Claude model writes the dreams. Override with the CLAUDE_MODEL env variable. */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

/** Default number of dreams allowed in any 24 hours (changeable in Settings). */
export const DEFAULT_DAILY_LIMIT = 20;

/** Used for seasons. Change to "south" if you live in the Southern Hemisphere. */
export const HEMISPHERE: "north" | "south" = "north";
