import { useSearchParams } from 'react-router-dom';
import { CheckoutPage } from './CheckoutPage';

export function CheckoutRoute() {
  const [params] = useSearchParams();
  const pay = params.get('pay');
  const to = params.get('to');
  const note = params.get('note') ?? undefined;
  const merchant = params.get('merchant') === '1';

  if (!pay || !to) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-outline">Invalid checkout link — missing amount or recipient.</p>
      </div>
    );
  }

  return (
    <CheckoutPage
      amount={parseFloat(pay)}
      recipient={to}
      note={note}
      merchantMode={merchant}
    />
  );
}
