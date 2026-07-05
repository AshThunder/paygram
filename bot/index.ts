/**
 * PayGram shell bot — opens Mini App only. No business logic.
 * Run: npm run bot (requires TELEGRAM_BOT_TOKEN + VITE_MINI_APP_URL in .env)
 */
import { Bot, InlineKeyboard } from 'grammy';

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.VITE_MINI_APP_URL;

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

if (!miniAppUrl) {
  console.error('Set VITE_MINI_APP_URL in .env');
  process.exit(1);
}

const bot = new Bot(token);

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('Open PayGram', miniAppUrl);
  await ctx.reply(
    'PayGram — type a payment in chat, confirm in one tap.\n\nNo chains. No gas. No seed phrases.',
    { reply_markup: keyboard },
  );
});

bot.on('message', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('Open PayGram', miniAppUrl);
  await ctx.reply('Open PayGram to send, tip, or split.', { reply_markup: keyboard });
});

bot.catch((err) => console.error('Bot error:', err));

console.log('PayGram shell bot running…');
bot.start();
