import YahooFinance from 'yahoo-finance2';

// Shared Yahoo Finance client for the market data services.
export const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
