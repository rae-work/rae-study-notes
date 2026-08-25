import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
const html = fs.readFileSync('/Users/rae/ruang-belajar/dist/rae-study-notes.html','utf8');
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if(!/HTMLMediaElement/.test(e.message)) console.log('JSDOM ERR:', e.message); });
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, url:'https://belajar.rae.work/'});
const w = dom.window, doc = w.document;
console.log('STORE.ok =', w.STORE.ok());

// 找一道 susun 题
w.go(w.DRILL_INDEX);
w.DR.types = {jam:false,angka:false,situasi:false,dengar:false,posesif:true,tunjuk:true,benda:false};
w.DR.count = 10;
w.drillStart(false);
let tries=0;
while(w.DR.curQ && w.DR.curQ.mode !== 'susun' && tries++ < 60){ w.drillNext(); }
console.log('题型 =', w.DR.curQ && w.DR.curQ.type, 'mode =', w.DR.curQ && w.DR.curQ.mode, 'idx=', w.DR.idx);
const before = {right:w.DR.right, answered:w.DR.answered, wrong:w.DR.wrong.length};
// 模拟按键 "2"
const ev = new w.KeyboardEvent('keydown', {key:'2', bubbles:true});
doc.dispatchEvent(ev);
console.log('按 2 之后: revealed=',w.DR.revealed,'pick=',w.DR.pick,'right=',w.DR.right,'answered=',w.DR.answered,'wrong=',w.DR.wrong.length);
const sheet = doc.getElementById('sheet').innerHTML;
console.log('页面显示为答对(sz-slot good)?', /sz-slot[^"]*good/.test(sheet));
console.log('有 ✓ 祝贺 toast?', /qz-toast/.test(sheet));
console.log('有「继续」按钮 data-dr="cont"?', /data-dr="cont"/.test(sheet));
console.log('有「检查」按钮 data-dr="check"?', /data-dr="check"/.test(sheet));
const btns=[...doc.querySelectorAll('#sheet [data-dr]')].map(b=>b.getAttribute('data-dr'));
console.log('本屏所有可点 data-dr:', JSON.stringify([...new Set(btns)]));
