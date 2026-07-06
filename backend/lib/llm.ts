import Anthropic from '@anthropic-ai/sdk';

// Returns a configured Anthropic (Claude) client for server-side LLM jobs.
//
// The ANTHROPIC_API_KEY is a SECRET — use it only here in trusted backend jobs
// (moderation, sweepers, scripts), NEVER in the web/mobile apps. An app that needs
// Claude must call a backend endpoint that holds the key, never hold it itself.
//
// The key is read from the ANTHROPIC_API_KEY env var. Callers load their env first
// (e.g. `dotenv.config({ path: 'backend/.env' })`); this just validates it.
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy backend/.env.example to backend/.env (gitignored) ' +
      'and add your key, or set it in the environment. Get a key from ' +
      'https://console.anthropic.com/settings/keys.',
    );
  }
  return new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
}
