export const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN'] as const;
export type Symbol = (typeof SYMBOLS)[number];
