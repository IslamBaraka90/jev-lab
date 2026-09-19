# Setup timing

- Real cached daily candles for NVDA, JPM, SPY and BTC-USD span September 2020 through September 2026. The page does not claim ten years where the committed cache contains six.
- Two readable strategy modules detect moving-average pullbacks and twenty-session range breaks. A deterministic round-robin across instrument, setup and direction retains 480 instances if the cache supplies them.
- Each Jev state includes the sixty daily candles through the setup, its detector conditions, calendar slot, days since the last 3% opening gap and a prior-only typical slot return. No forward candle or realised return is sent.
- Daily data cannot answer time-of-day questions; intraday timing is explicitly out of scope.
