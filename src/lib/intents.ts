import { z } from 'zod';

export const sendIntentSchema = z.object({
  type: z.literal('send'),
  amount: z.number().positive(),
  currency: z.literal('USD'),
  recipient: z.string().min(1),
  note: z.string().optional(),
});

export const tipIntentSchema = z.object({
  type: z.literal('tip'),
  amount: z.number().positive(),
  recipient: z.string().min(1),
  note: z.string().optional(),
});

export const requestIntentSchema = z.object({
  type: z.literal('request'),
  amount: z.number().positive(),
  from: z.string().min(1),
  note: z.string().optional(),
});

export const splitIntentSchema = z.object({
  type: z.literal('split'),
  total: z.number().positive(),
  recipients: z.array(z.string().min(1)).min(1),
  note: z.string().optional(),
});

export const collectIntentSchema = z.object({
  type: z.literal('collect'),
  goal: z.number().positive(),
  title: z.string().min(1),
});

export const contributeIntentSchema = z.object({
  type: z.literal('contribute'),
  amount: z.number().positive(),
  potId: z.string().min(1),
});

export const balanceIntentSchema = z.object({
  type: z.literal('balance'),
});

export const giftIntentSchema = z.object({
  type: z.literal('gift'),
  amount: z.number().positive(),
});

export const remindIntentSchema = z.object({
  type: z.literal('remind'),
  target: z.string().min(1),
  amount: z.number().positive().optional(),
});

export const recurringTipIntentSchema = z.object({
  type: z.literal('recurring_tip'),
  amount: z.number().positive(),
  recipient: z.string().min(1),
  intervalDays: z.number().positive().default(7),
});

export const swapIntentSchema = z.object({
  type: z.literal('swap'),
  amount: z.number().positive(),
  toToken: z.string().min(1),
});

export const unknownIntentSchema = z.object({
  type: z.literal('unknown'),
  raw: z.string(),
});

export const intentSchema = z.discriminatedUnion('type', [
  sendIntentSchema,
  tipIntentSchema,
  requestIntentSchema,
  splitIntentSchema,
  collectIntentSchema,
  contributeIntentSchema,
  balanceIntentSchema,
  giftIntentSchema,
  remindIntentSchema,
  recurringTipIntentSchema,
  swapIntentSchema,
  unknownIntentSchema,
]);

export type Intent = z.infer<typeof intentSchema>;
export type SendIntent = z.infer<typeof sendIntentSchema>;
export type TipIntent = z.infer<typeof tipIntentSchema>;
export type RequestIntent = z.infer<typeof requestIntentSchema>;
export type SplitIntent = z.infer<typeof splitIntentSchema>;
export type CollectIntent = z.infer<typeof collectIntentSchema>;
export type GiftIntent = z.infer<typeof giftIntentSchema>;
export type RemindIntent = z.infer<typeof remindIntentSchema>;
export type RecurringTipIntent = z.infer<typeof recurringTipIntentSchema>;
export type SwapIntent = z.infer<typeof swapIntentSchema>;
