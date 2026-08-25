import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
const html = fs.readFileSync('/Users/rae/ruang-belajar/dist/rae-study-notes.html','utf8');
const vc = new VirtualConsole();
function mk(){
  return new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, url:'https://belajar.rae.work/'});
}
function snapshot(w, oldStyle){
  const doc = w.document, sheet = doc.getElementById('sheet');
  if(oldStyle){
    // 还原 main 上这四个函数的写法（不含 LZ）
    w.clean = function(s){ return s.replace(/[?!.,:;"'’“”()／/]+/g," ").replace(/\s+/g," ").trim(); };
    w.sayText = function(s){ return s.replace(/[“”‘’"']/g,"").replace(/[()（）／/]+/g," ").replace(/\s+/g," ").trim(); };
    w.sayLine = function(text, kw){
      var k=[],i; if(kw) for(i=0;i<kw.length;i++) k.push(String(kw[i]).toLowerCase());
      var toks=text.split(/(\s+)/), out="";
      for(i=0;i<toks.length;i++){ var t=toks[i];
        if(/^\s+$/.test(t)){ out+=t; continue; }
        var c=w.clean(t).toLowerCase();
        out+='<span class="say'+(k.indexOf(c)>=0?" kw":"")+'" data-say="'+w.esc(w.clean(t))+'">'+w.esc(t)+"</span>";
      } return out;
    };
    w.sayWhole = function(display, say, extra){
      return '<span class="say '+(extra||"")+'" data-say="'+w.esc(say!=null?say:w.clean(display))+'">'+
        w.breakable(w.esc(display))+"</span>";
    };
  }
  const out = {};
  for(const lang of ['zh','ja','en']){
    w.setLang(lang);
    for(let i=0;i<w.PAGES.length;i++){
      w.go(i);
      out[lang+':'+i] = sheet.innerHTML;
    }
    // 词汇表卡片单独取（分批渲染）
    out[lang+':gloss'] = w.VOCAB.map(v=>w.glossCard(v)).join('\n');
  }
  return out;
}
const A = mk(); A.window.localStorage.clear();
const newSnap = snapshot(A.window, false);
const B = mk(); B.window.localStorage.clear();
const oldSnap = snapshot(B.window, true);
let n=0;
for(const k of Object.keys(newSnap)){
  if(newSnap[k] === oldSnap[k]) continue;
  n++;
  // 找出第一处差异附近
  const a=newSnap[k], b=oldSnap[k];
  let i=0; while(i<a.length && i<b.length && a[i]===b[i]) i++;
  console.log('=== 差异 @', k);
  console.log('  新:', JSON.stringify(a.slice(Math.max(0,i-90), i+120)));
  console.log('  旧:', JSON.stringify(b.slice(Math.max(0,i-90), i+120)));
}
console.log('有差异的快照数:', n, '/', Object.keys(newSnap).length);
