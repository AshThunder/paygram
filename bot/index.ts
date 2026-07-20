/**
 * PayGram bot — Mini App launcher + /pay /request /split commands.
 * Run: npm run bot (requires TELEGRAM_BOT_TOKEN + VITE_MINI_APP_URL in .env)
 */
import { Bot, InlineKeyboard } from 'grammy';

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.VITE_MINI_APP_URL;
const botUsername = process.env.VITE_BOT_USERNAME || 'paygram_bbot';

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

if (!miniAppUrl) {
  console.error('Set VITE_MINI_APP_URL in .env');
  process.exit(1);
}

const bot = new Bot(token);

function startLink(startapp: string): string {
  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(startapp)}`;
}

function parseAmount(text: string): number | null {
  const match = text.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/,/g, ''));
  return n > 0 ? n : null;
}

function parseHandles(text: string): string[] {
  return [...text.matchAll(/@([a-zA-Z0-9_]{3,})/g)].map((m) => m[1].toLowerCase());
}

function replyUsername(ctx: { message?: { reply_to_message?: { from?: { username?: string; first_name?: string } } } }): string | null {
  const from = ctx.message?.reply_to_message?.from;
  if (!from) return null;
  return from.username?.toLowerCase() ?? null;
}

function payKeyboard(startapp: string, label: string) {
  return new InlineKeyboard()
    .url(label, startLink(startapp))
    .row()
    .webApp('Open PayGram', miniAppUrl);
}

bot.api.setMyCommands([
  { command: 'start', description: 'Open PayGram' },
  { command: 'pay', description: 'Pay someone — /pay $25 @alice or reply' },
  { command: 'request', description: 'Request money — reply to their message' },
  { command: 'split', description: 'Split a bill — /split $120 @a @b' },
]);

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('Open PayGram', miniAppUrl);
  await ctx.reply(
    'PayGram — type a payment in chat, confirm in one tap.\n\nCommands: /pay · /request · /split',
    { reply_markup: keyboard },
  );
});

bot.command('pay', async (ctx) => {
  const text = ctx.message?.text ?? '';
  const amount = parseAmount(text);
  const handles = parseHandles(text);
  const replyUser = replyUsername(ctx);
  const target = handles[0] ?? replyUser;

  if (!amount || !target) {
    await ctx.reply(
      'Usage:\n/pay $25 @alice\nor reply to someone\'s message with:\n/pay $25',
      { reply_markup: payKeyboard('pay_0_help', 'Open PayGram') },
    );
    return;
  }

  const startapp = `pay_${amount}_${target}`;
  await ctx.reply(`Pay $${amount.toFixed(2)} to @${target}`, {
    reply_markup: payKeyboard(startapp, `Pay $${amount.toFixed(0)} in PayGram`),
  });
});

bot.command('request', async (ctx) => {
  const text = ctx.message?.text ?? '';
  const amount = parseAmount(text);
  const handles = parseHandles(text);
  const replyUser = replyUsername(ctx);
  const from = handles[0] ?? replyUser;

  if (!amount || !from) {
    await ctx.reply(
      'Reply to someone\'s message with:\n/request $30 for lunch\nor:\n/request $30 @bob',
      { reply_markup: payKeyboard('request_0_help', 'Open PayGram') },
    );
    return;
  }

  const noteMatch = text.match(/\bfor\s+(.+)$/i);
  const note = noteMatch?.[1]?.trim();
  const startapp = note
    ? `request_${amount}_${from}_${encodeURIComponent(note.slice(0, 40))}`
    : `request_${amount}_${from}`;

  await ctx.reply(`Request $${amount.toFixed(2)} from @${from}`, {
    reply_markup: payKeyboard(startapp, `Request in PayGram`),
  });
});

bot.command('split', async (ctx) => {
  const text = ctx.message?.text ?? '';
  const amount = parseAmount(text);
  const handles = parseHandles(text);

  if (!amount || handles.length < 2) {
    await ctx.reply(
      'Usage: /split $120 @alice @bob @carol\nor scan a receipt in PayGram chat.',
      { reply_markup: payKeyboard('split_0_help', 'Open PayGram') },
    );
    return;
  }

  const startapp = `split_${amount}_${handles.join('-')}`;
  await ctx.reply(`Split $${amount.toFixed(2)} with ${handles.map((h) => `@${h}`).join(', ')}`, {
    reply_markup: payKeyboard(startapp, `Split in PayGram`),
  });
});

bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  const keyboard = new InlineKeyboard().webApp('Open PayGram', miniAppUrl);
  await ctx.reply('Use /pay, /request, or /split — or open PayGram.', { reply_markup: keyboard });
});

bot.catch((err) => console.error('Bot error:', err));

console.log('PayGram bot running (commands: /pay /request /split)…');
bot.start();
