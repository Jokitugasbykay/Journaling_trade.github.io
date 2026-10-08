const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const feed = {meetings:[{date:'2026-10-28',decisionAt:'2026-10-28T18:00:00Z'},{date:'2026-12-09',decisionAt:'2026-12-09T19:00:00Z'}],
  currentTarget:{asOf:'2026-09-16',lower:3.75,upper:4}, scheduleStatus:'ok', probabilities:[
    {name:'Test snapshot',url:'https://growbeansprout.com/tools/fedwatch',meetingDate:'2026-10-28',asOf:'2026-10-07T06:00:00Z',status:'ok',
      distribution:[{lower:3.75,upper:4,probability:81.6},{lower:4,upper:4.25,probability:18.4}]}]};
let now = Date.parse('2026-10-08T03:00:00Z');
class Clock extends Date { static now() { return now; } }
const digits = Array.from({length:4}, () => ({textContent:''}));
const panel = {hidden:false, dataset:{}, innerHTML:'', querySelectorAll:() => digits};
const intervals = [];
const context = {window:{}, document:{documentElement:{lang:'en'}, getElementById:() => panel}, Date:Clock,
  MutationObserver:class {observe() {}}, AbortSignal, setInterval:cb => {intervals.push(cb); return intervals.length;}, clearInterval(){},
  fetch:async() => ({ok:true, json:async() => feed})};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, 'fed.js'), 'utf8'), context);
(async() => {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(panel.dataset.meeting, '2026-10-28');
  assert.equal(digits[0].textContent, '20');
  assert.ok(panel.innerHTML.includes('81.6%') && panel.innerHTML.includes('Hold'));
  assert.ok(panel.innerHTML.includes('WIB') && panel.innerHTML.includes('Saved snapshot'));
  feed.probabilities[0].meetingDate = '2026-07-29';
  context.window.renderFedWatch();
  assert.ok(panel.innerHTML.includes('No verified snapshot for this meeting.'));
  context.document.documentElement.lang='id'; context.window.renderFedWatch();
  assert.ok(panel.innerHTML.includes('Keputusan FOMC berikutnya'));
  now=Date.parse('2026-10-28T18:00:01Z'); intervals[1]();
  assert.equal(panel.dataset.meeting,'2026-12-09');
  assert.ok(digits.every(d=>Number(d.textContent)>=0));
  console.log('FOMC timezone, countdown rollover, dated snapshots and meeting isolation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
