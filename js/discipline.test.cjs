const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
const helper = source.slice(source.indexOf('      function disciplineMetrics('), source.indexOf('      let exchangeBusy'));
const metrics = vm.runInNewContext(helper + '\ndisciplineMetrics');
assert.equal(metrics([]).avgRisk, null);
const report = metrics([{sl: 100, riskPct: 1}, {sl: null, riskPct: 2}, {sl: 0, riskPct: null}]);
assert.equal(report.total, 3);
assert.ok(Math.abs(report.slPct - 100 / 3) < 1e-10);
assert.equal(report.avgRisk, 1.5);
assert.equal(report.riskCount, 2);
console.log('Discipline checks passed');
const nodes = new Map();
const ctx = {currentAccount:()=>({startBalance:0}),trades:[],profile:{currentAccount:'local'},settings:{kurs:17000},language:'en',disciplineMetrics:metrics,
  $:id=>{ if (!nodes.has(id)) nodes.set(id,{style:{}}); return nodes.get(id); },
  fmtPLUSD:String,fmtPLIDR:String,fmtUSD:String,drawKpiSparklines(){},drawEquityCurveSVG(){},drawDonutChartSVG(){},drawBreakdownBars(){}};
ctx.window=ctx;
vm.runInNewContext(source.slice(source.indexOf('      window.renderStatistics ='),source.indexOf('      function drawKpiSparklines(')),ctx);
ctx.renderStatistics();
assert.equal(nodes.get('kpi-netpl-delta').textContent,'Add a starting balance');
assert.equal(nodes.get('kpi-netpl').textContent,'0');
console.log('Empty account does not display NaN balance return');
