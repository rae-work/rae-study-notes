import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
const html = fs.readFileSync('/Users/rae/ruang-belajar/dist/rae-study-notes.html','utf8');
const vc=new VirtualConsole(); vc.on('jsdomError',e=>{if(!/HTMLMediaElement/.test(e.message))console.log('ERR',e.message);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://belajar.rae.work/'});
const w=dom.window, doc=w.document;

// D. 复习出题：所有词都「练熟了」时还能不能凑够题
w.go(w.REVIEW_INDEX);
w.CONTENT.lessons.forEach(l=>{ w.QZ.sel[l.num]=true; });
w.PROG.w={}; w.VOCAB.forEach(v=>{ w.PROG.w[v.w]=[5,0,1]; });   // 全部 level 3
w.QZ.count=20; w.QZ.mode='mix'; w.quizStart(false);
console.log('D1 全部练熟 → 队列', w.QZ.queue.length, 'plan', w.QZ.plan, 'phase', w.QZ.phase);
w.PROG.w={}; w.VOCAB.slice(0,3).forEach(v=>{ w.PROG.w[v.w]=[0,3,1]; });  // 3 个还在错
w.quizStart(false);
const first3 = w.QZ.queue.slice(0,20).filter(v=>w.progLevel(v.w)===1).length;
console.log('D2 3 个错词 → 队列', w.QZ.queue.length, '其中错词', first3);
w.PROG.w={}; w.quizStart(false);
console.log('D3 无记录 → 队列', w.QZ.queue.length);

// E. 实战「重做错题」路径（含拼句）
w.go(w.DRILL_INDEX);
w.DR.types={jam:false,angka:false,situasi:false,dengar:false,posesif:true,tunjuk:true,benda:false};
w.DR.count=10; w.drillStart(false);
for(let i=0;i<10 && w.DR.curQ;i++){
  const q=w.DR.curQ;
  if(q.mode==='susun'){ w.susunPick(0); w.susunCheck(); }   // 故意乱拼
  else w.drillAnswer((q.ok+1)%4);
  w.drillNext();
}
console.log('E1 错题数', w.DR.wrong.length);
w.drillStart(true);
console.log('E2 重做队列', w.DR.queue.length, 'curQ.mode', w.DR.curQ&&w.DR.curQ.mode,
  'picked', JSON.stringify(w.DR.curQ&&w.DR.curQ.picked), 'revealed', w.DR.revealed);
let ok2=true;
for(let i=0;i<w.DR.queue.length && w.DR.curQ;i++){
  const q=w.DR.curQ;
  if(q.mode==='susun'){
    const need=String(q.a).toLowerCase().replace(/[.!?,]/g,'').replace(/\s+/g,' ').trim().split(' ');
    const used={};
    for(const nw of need){ const bi=q.bank.findIndex((b,ix)=>!used[ix]&&b.toLowerCase().replace(/[.!?,]/g,'')===nw); if(bi<0){ok2=false;break;} used[bi]=1; w.susunPick(bi); }
    w.susunCheck();
  } else w.drillAnswer(q.ok);
  w.drillNext();
}
console.log('E3 重做全对?', w.DR.right, '/', w.DR.answered, ' 拼得出?', ok2, ' phase', w.DR.phase);

// F. 记住阅读位置
w.go(3); console.log('F1 存的位置', JSON.stringify(w.STORE.get('pos',null)));
w.go(w.GLOSS_INDEX); console.log('F2', JSON.stringify(w.STORE.get('pos',null)));
console.log('F3 pageKey 是否唯一:', new Set(w.PAGES.map(w.pageKey)).size, '/', w.PAGES.length);

// G. 学习记录体积
w.PROG.w={}; w.VOCAB.forEach(v=>{w.PROG.w[v.w]=[3,1,20000];});
['posesif','tunjuk'].forEach(k=>(w.CONTENT.drills[k]||[]).forEach(x=>{w.PROG.w['q:'+x.id]=[2,2,20000];}));
console.log('G 满记录 JSON 字节', JSON.stringify(w.PROG).length, ' 计数', JSON.stringify(w.progCount()));
