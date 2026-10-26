self.window=self;
self.document={baseURI:new URL('../',self.location.href).href};
importScripts('pro-import.js?v=20261026-backtest-fixed','market-history.js?v=20261026-backtest-fixed','pro.js?v=20261026-backtest-fixed');
self.onmessage=event=>{
  try{
    const {candles,csv,config}=event.data;
    const bars=csv?self.JTMarketHistory.parseCSV(csv,config.instrument,config.timeframe):candles;
    const result=self.JTPRO.runKaystradeBacktestEngine(bars,config);
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
