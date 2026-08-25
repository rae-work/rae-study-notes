import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
const html = fs.readFileSync('/Users/rae/ruang-belajar/dist/rae-study-notes.html','utf8');
const vc = new VirtualConsole();
const mk=()=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://belajar.rae.work/'});
function patchOld(w){
  w.clean=function(s){return s.replace(/[?!.,:;"'’“”()／/]+/g," ").replace(/\s+/g," ").trim();};
  w.sayText=function(s){return s.replace(/[“”‘’"']/g,"").replace(/[()（）／/]+/g," ").replace(/\s+/g," ").trim();};
  w.sayLine=function(text,kw){var k=[],i;if(kw)for(i=0;i<kw.length;i++)k.push(String(kw[i]).toLowerCase());
    var toks=text.split(/(\s+)/),out="";for(i=0;i<toks.length;i++){var t=toks[i];
    if(/^\s+$/.test(t)){out+=t;continue;}var c=w.clean(t).toLowerCase();
    out+='<span class="say'+(k.indexOf(c)>=0?" kw":"")+'" data-say="'+w.esc(w.clean(t))+'">'+w.esc(t)+"</span>";}return out;};
  w.sayWhole=function(d,say,ex){return '<span class="say '+(ex||"")+'" data-say="'+w.esc(say!=null?say:w.clean(d))+'">'+w.breakable(w.esc(d))+"</span>";};
}
function collect(w){
  const doc=w.document, sheet=doc.getElementById('sheet');
  const says=[], kws=[], wbr=[], text=[];
  for(const lang of ['zh','ja','en']){
    w.setLang(lang);
    const parts=[];
    for(let i=0;i<w.PAGES.length;i++){ w.go(i); parts.push(sheet.innerHTML); }
    parts.push(w.VOCAB.map(v=>w.glossCard(v)).join('\n'));
    for(const [pi,h] of parts.entries()){
      const d=doc.createElement('div'); d.innerHTML=h;
      d.querySelectorAll('[data-say]').forEach(el=>says.push(lang+'|'+pi+'|'+el.getAttribute('data-say')));
      d.querySelectorAll('.kw').forEach(el=>kws.push(lang+'|'+pi+'|'+el.textContent));
      wbr.push(lang+'|'+pi+'|'+ (h.split('<wbr>').length-1));
      text.push(lang+'|'+pi+'|'+(d.textContent||'').replace(/\s+/g,' '));
    }
  }
  return {says,kws,wbr,text};
}
const A=mk(); A.window.localStorage.clear(); const N=collect(A.window);
const B=mk(); B.window.localStorage.clear(); patchOld(B.window); const O=collect(B.window);
function diff(name,a,b){
  const sa=new Map(), sb=new Map();
  a.forEach(x=>sa.set(x,(sa.get(x)||0)+1)); b.forEach(x=>sb.set(x,(sb.get(x)||0)+1));
  const onlyNew=[...sa.keys()].filter(k=>(sb.get(k)||0)!==sa.get(k));
  const onlyOld=[...sb.keys()].filter(k=>(sa.get(k)||0)!==sb.get(k));
  console.log('### '+name+'  仅新:'+onlyNew.length+'  仅旧:'+onlyOld.length);
  onlyNew.slice(0,25).forEach(x=>console.log('  新+',x));
  onlyOld.slice(0,25).forEach(x=>console.log('  旧-',x));
}
diff('data-say', N.says, O.says);
diff('kw 关键词元素', N.kws, O.kws);
diff('<wbr> 数量', N.wbr, O.wbr);
diff('可见文字', N.text, O.text);
