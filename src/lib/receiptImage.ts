import { formatUsd } from './constants';

export type ReceiptCardData = {
  amount: number;
  payer: string;
  recipient?: string;
  note?: string;
  emoji?: string;
};

export async function generateReceiptImage(data: ReceiptCardData): Promise<Blob> {
  const width = 640;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#f9f9fa';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#006190';
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = '#006190';
  ctx.font = '600 22px Inter, system-ui, sans-serif';
  ctx.fillText('PayGram', 32, 48);

  ctx.fillStyle = '#1a1c1d';
  ctx.font = 'bold 48px Inter, system-ui, sans-serif';
  ctx.fillText(`${data.emoji ?? '✅'} ${formatUsd(data.amount)}`, 32, 120);

  ctx.fillStyle = '#40484f';
  ctx.font = '500 24px Inter, system-ui, sans-serif';
  if (data.recipient) {
    ctx.fillText(`to ${data.recipient}`, 32, 168);
  }

  ctx.fillStyle = '#707880';
  ctx.font = '400 18px Inter, system-ui, sans-serif';
  ctx.fillText(`from ${data.payer}`, 32, 210);

  if (data.note) {
    ctx.fillStyle = '#707880';
    ctx.font = 'italic 18px Inter, system-ui, sans-serif';
    const note = data.note.length > 48 ? `${data.note.slice(0, 45)}…` : data.note;
    ctx.fillText(note, 32, 250);
  }

  ctx.fillStyle = '#006e2a';
  ctx.font = '400 14px Inter, system-ui, sans-serif';
  ctx.fillText('Gasless · cross-chain · PayGram', 32, height - 32);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create image'));
    }, 'image/png');
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('Invalid image data'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
