// Small, browser-safe statement cross-checks. The model never sees this output; reports do.

const finite = (value) => Number.isFinite(value);
const ratio = (top, bottom) => finite(top) && finite(bottom) && bottom !== 0 ? top / bottom : null;
const change = (from, to) => finite(from) && finite(to) && from !== 0 ? (to - from) / Math.abs(from) : null;
const round = (value, digits = 2) => finite(value) ? Number(value.toFixed(digits)) : null;

// #region demo:data
export function computedRatios(item) {
  const years = item.annualStatements ?? [];
  const first = years[0];
  const latest = years.at(-1);
  const statementGap = years.length < 4 ? 'SHORT_HISTORY'
    : years.some((year) => !finite(year.operatingCashFlow) || !finite(year.capitalExpenditure)) ? 'MISSING_CASH_FLOW'
      : years.some((year) => !finite(year.totalDebt) || !finite(year.cash) || !finite(year.equity)) ? 'MISSING_BALANCE_SHEET' : 'NONE';
  if (statementGap !== 'NONE') return { statementGap, complete: false };
  const operatingMargin = (year) => ratio(year.operatingIncome, year.revenue);
  const netDebt = latest.totalDebt - latest.cash;
  const ebitdaProxy = latest.operatingIncome + Math.abs(latest.capitalExpenditure) * 0.4;
  const cashConversion = ratio(years.reduce((sum, year) => sum + year.operatingCashFlow, 0), years.reduce((sum, year) => sum + year.netIncome, 0));
  const debtToEquity = ratio(latest.totalDebt, latest.equity);
  const netDebtToEbitdaProxy = ratio(netDebt, ebitdaProxy);
  const revenueTrend = change(first.revenue, latest.revenue);
  const marginTrend = operatingMargin(latest) - operatingMargin(first);
  const earningsQuality = cashConversion >= 0.9 ? 'CASH_BACKED' : cashConversion < 0.7 ? 'ACCRUAL_HEAVY' : 'MIXED';
  const direction = revenueTrend > 0.03 && marginTrend >= 0 ? 'IMPROVING' : revenueTrend < -0.03 || marginTrend < -0.015 ? 'DETERIORATING' : 'STABLE';
  const leverageScore = netDebt <= 0 ? 0 : debtToEquity < 0.5 && netDebtToEbitdaProxy < 1 ? 1 : debtToEquity < 1 && netDebtToEbitdaProxy < 2 ? 2 : debtToEquity < 1.8 && netDebtToEbitdaProxy < 3 ? 3 : debtToEquity < 3 && netDebtToEbitdaProxy < 5 ? 4 : 5;
  const capexDiscipline = years.every((year) => year.operatingCashFlow + year.capitalExpenditure > 0) && Math.abs(latest.capitalExpenditure) / latest.revenue < 0.2;
  return { statementGap, complete: true, debtToEquity: round(debtToEquity), netDebtToEbitdaProxy: round(netDebtToEbitdaProxy), cashConversion: round(cashConversion), marginTrendPoints: round(marginTrend * 100, 1), revenueTrendPercent: round(revenueTrend * 100, 1), earningsQuality, direction, leverageScore, capexDiscipline };
}
// #endregion

// #region demo:dividend-data
export function dividendRatios(item) {
  const years = item.annualStatements ?? [];
  const complete = years.length >= 4 && years.every((year) => [year.dividendsPaid, year.netIncome, year.operatingCashFlow, year.capitalExpenditure].every(finite));
  if (!complete || !finite(item.latestPrice) || !finite(item.sharesOutstanding) || item.sharesOutstanding <= 0) {
    return { complete: false, coverageGap: years.length < 4 ? 'SHORT_HISTORY' : 'MISSING_LINES', historicalCuts: [] };
  }
  const first = years[0];
  const latest = years.at(-1);
  const paid = (year) => Math.abs(year.dividendsPaid);
  const freeCashFlow = (year) => year.operatingCashFlow + year.capitalExpenditure;
  const payoutOnEarnings = ratio(paid(latest), latest.netIncome);
  const payoutOnFcf = ratio(paid(latest), freeCashFlow(latest));
  const dividendGrowth = paid(first) > 0 ? (paid(latest) / paid(first)) ** (1 / (years.length - 1)) - 1 : null;
  const yieldPercent = paid(latest) / item.sharesOutstanding / item.latestPrice * 100;
  const debtChange = change(first.totalDebt, latest.totalDebt);
  const historicalCuts = years.slice(1).flatMap((year, index) => paid(year) < paid(years[index]) * 0.98 ? [{ from: years[index].fiscalYearEnd, to: year.fiscalYearEnd, changePercent: round(change(paid(years[index]), paid(year)) * 100, 1) }] : []);
  const debtFunded = finite(debtChange) ? freeCashFlow(latest) < paid(latest) && debtChange > 0.05 : null;
  let safetyScore = 6;
  if (freeCashFlow(latest) <= 0 || payoutOnFcf > 1.2) safetyScore -= 3;
  else if (payoutOnFcf > 0.9) safetyScore -= 2;
  else if (payoutOnFcf > 0.7) safetyScore -= 1;
  if (latest.netIncome <= 0 || payoutOnEarnings > 1.2) safetyScore -= 2;
  else if (payoutOnEarnings > 0.8) safetyScore -= 1;
  if (debtFunded === true) safetyScore -= 1;
  if (historicalCuts.length) safetyScore -= 2;
  safetyScore = Math.max(0, Math.min(6, safetyScore));
  const firstToBreak = freeCashFlow(latest) <= paid(latest) ? 'CASH_COVER'
    : latest.netIncome <= paid(latest) ? 'EARNINGS_COVER'
      : debtFunded === true ? 'DEBT_MATURITIES'
        : ['Energy', 'Basic Materials'].includes(item.sector) && payoutOnFcf > 0.65 ? 'CYCLICALITY' : 'NONE';
  return {
    complete: true, coverageGap: finite(debtChange) ? 'NONE' : 'MISSING_DEBT', payoutOnEarnings: round(payoutOnEarnings), payoutOnFcf: round(payoutOnFcf),
    dividendGrowthPercent: round(dividendGrowth * 100, 1), yieldPercent: round(yieldPercent, 2), debtChangePercent: finite(debtChange) ? round(debtChange * 100, 1) : null,
    historicalCuts, debtFunded, safetyScore, firstToBreak,
  };
}
// #endregion
