# Setup timing

- Real cached daily candles for NVDA, JPM, SPY and BTC-USD span September 2020 through September 2026. The page does not claim ten years where the committed cache contains six.
- Two readable strategy modules detect moving-average pullbacks and twenty-session range breaks. A deterministic round-robin across instrument, setup and direction retains 480 instances if the cache supplies them.
- Each Jev state includes up to sixty daily candles through the setup (19 early instances have fewer), its detector conditions, calendar slot, days since the last 3% opening gap and a prior-only typical slot return. No forward candle or realised return is sent.
- Daily data cannot answer time-of-day questions; intraday timing is explicitly out of scope.
- Jev 1.13.0 was called once for every one of the 480 states (2,669,998 input and 102,590 output tokens); all five answers per state are cached in `fixtures.json`.
- The recorded replay finds 0 of 127 weekday-by-month cells at the required 20-instance minimum, so the interface greys out every cell rather than implying unsupported seasonality. Across all 480 instances, Jev's favourable call matches the signed five-bar return 52.1% of the time and its holding-window choice matches the best realised 1/3/5/8-bar window 17.3% of the time.
