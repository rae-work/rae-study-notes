import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
const html = fs.readFileSync('/Users/rae/ruang-belajar/dist/rae-study-notes.html','utf8');
const vc = new VirtualConsole();
vc.on('jsdomError', e=>{ if(!/HTMLMediaElement/.test(e.message)) console.log('JSDOM ERR:', e.message); });
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://belajar.rae.work/'});
const w=dom.window, doc=w.document;

// ---- A. 「清除学习记录」二次确认在切语言后是否失效 ----
w.PROG.w['buku']=[1,0,1]; w.progSave && null;
const btn=doc.getElementById('progClear');
w.syncProgUI();
console.log('A1 按钮可用:', !btn.disabled, '文字:', JSON.stringify(btn.textContent));
btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
console.log('A2 第一下之后 文字:', JSON.stringify(btn.textContent), 'armed:', btn.classList.contains('armed'));
w.setLang('ja');                       // 切语言 → applyStaticText → syncProgUI
console.log('A3 切语言后 文字:', JSON.stringify(btn.textContent), 'armed:', btn.classList.contains('armed'));
btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
console.log('A4 再点一下 → 记录条数:', w.progCount().all, '（0 = 没有二次确认就清掉了）');
w.setLang('zh');

// ---- B. 实战：跑满一轮，看有没有崩、有没有死局 ----
w.PROG.w={};
w.go(w.DRILL_INDEX);
for(const only of ['posesif','tunjuk','benda','situasi','dengar']){
  w.DR.types={jam:false,angka:false,situasi:false,dengar:false,posesif:false,tunjuk:false,benda:false};
  w.DR.types[only]=true;
  w.DR.count=12; w.drillStart(false);
  let stuck=0;
  for(let i=0;i<12 && w.DR.curQ;i++){
    const q=w.DR.curQ;
    if(q.mode==='susun'){
      // 按正确顺序点词块
      const need=String(q.a).toLowerCase().replace(/[.!?,]/g,'').replace(/\s+/g,' ').trim().split(' ');
      const used={};
      for(const nw of need){
        const bi=q.bank.findIndex((b,ix)=>!used[ix] && b.toLowerCase().replace(/[.!?,]/g,'')===nw);
        if(bi<0){ console.log('  !! 拼不出', only, q.src.id); break; }
        used[bi]=1; w.susunPick(bi);
      }
      w.susunCheck();
    } else {
      w.drillAnswer(q.ok);
    }
    const h=doc.getElementById('sheet').innerHTML;
    const canGo=/data-dr="cont"/.test(h);
    if(!canGo && !/qz-toast/.test(h)) stuck++;
    w.drillNext();
  }
  console.log('B:',only,'→ 答完', w.DR.answered,'题 对', w.DR.right, ' phase=', w.DR.phase, ' 卡住次数', stuck);
}

// ---- C. 答错后的反馈屏，每种题型都要能继续 ----
w.go(w.DRILL_INDEX);
for(const only of ['posesif','tunjuk','benda']){
  w.DR.types={jam:false,angka:false,situasi:false,dengar:false,posesif:false,tunjuk:false,benda:false};
  w.DR.types[only]=true; w.DR.count=8; w.drillStart(false);
  for(let i=0;i<8 && w.DR.curQ;i++){
    const q=w.DR.curQ;
    if(q.mode==='susun'){ w.susunPick(0); w.susunCheck(); }
    else w.drillAnswer((q.ok+1)%4);
    const h=doc.getElementById('sheet').innerHTML;
    if(!/data-dr="cont"/.test(h)) console.log('  !! 答错后没有「继续」:', only, q.mode, q.src?q.src.id:'');
    w.drillNext();
  }
  console.log('C:',only,'答错流程 ok');
}
