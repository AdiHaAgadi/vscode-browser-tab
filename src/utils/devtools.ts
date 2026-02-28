// ── DevTools script injected into every proxied HTML page ─────────────────────
// Uses parent.postMessage to relay data to browser.js in the webview.
const DEVTOOLS_SCRIPT = `(function(){
  if(window.__btInjected){return;}window.__btInjected=true;
  // Console Mirror
  ['log','info','warn','error','debug'].forEach(function(lvl){
    var o=console[lvl].bind(console);
    console[lvl]=function(){
      o.apply(console,arguments);
      try{
        var args=Array.prototype.slice.call(arguments).map(function(a){
          try{return typeof a==='object'?JSON.stringify(a,null,0):String(a);}catch(e){return String(a);}
        });
        parent.postMessage({type:'__bt_console',level:lvl,args:args},'*');
      }catch(e){}
    };
  });
  // Network — fetch
  var _fetch=window.fetch;
  if(_fetch){
    window.fetch=function(input,init){
      var u=typeof input==='string'?input:(input&&input.url)||String(input);
      var m=((init&&init.method)||'GET').toUpperCase();
      var id=Date.now()+'_'+Math.random();
      parent.postMessage({type:'__bt_network_request',reqId:id,method:m,url:u},'*');
      return _fetch.apply(this,arguments).then(function(r){
        parent.postMessage({type:'__bt_network_response',reqId:id,status:r.status,statusText:r.statusText,url:u},'*');
        return r;
      })['catch'](function(e){
        parent.postMessage({type:'__bt_network_response',reqId:id,status:0,statusText:'Network error',url:u},'*');
        throw e;
      });
    };
  }
  // Network — XHR
  var _XHR=window.XMLHttpRequest;
  if(_XHR){
    window.XMLHttpRequest=function(){
      var x=new _XHR();var info={m:'GET',u:''};var id=Date.now()+'_'+Math.random();
      var _open=x.open.bind(x);
      x.open=function(m,u){info.m=(m||'GET').toUpperCase();info.u=u||'';return _open.apply(x,arguments);};
      x.addEventListener('loadstart',function(){parent.postMessage({type:'__bt_network_request',reqId:id,method:info.m,url:info.u},'*');});
      x.addEventListener('loadend',function(){parent.postMessage({type:'__bt_network_response',reqId:id,status:x.status,statusText:x.statusText,url:info.u},'*');});
      return x;
    };
    window.XMLHttpRequest.prototype=_XHR.prototype;
  }
  // Inspect mode — controlled by postMessage from parent
  var hl=null;
  function move(e){
    var el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||el===hl){return;}
    var r=el.getBoundingClientRect();
    hl.style.left=r.left+'px';hl.style.top=r.top+'px';hl.style.width=r.width+'px';hl.style.height=r.height+'px';
  }
  function click(e){
    e.preventDefault();e.stopPropagation();
    var el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||el===hl){return;}
    parent.postMessage({type:'__bt_inspect_element',tag:el.tagName.toLowerCase(),id:el.id||'',classes:Array.from(el.classList)},'*');
  }
  window.addEventListener('message',function(ev){
    var msg=ev.data;if(!msg||!msg.type){return;}
    if(msg.type==='__bt_enable_inspect'){
      if(hl){return;}
      hl=document.createElement('div');hl.id='__bt_hl';
      hl.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;border:2px solid #f0b429;background:rgba(240,180,41,0.08);border-radius:2px;transition:all 0.08s;';
      document.body.appendChild(hl);
      document.addEventListener('mousemove',move);document.addEventListener('click',click,true);
      document.body.style.cursor='crosshair';
    }
    if(msg.type==='__bt_disable_inspect'){
      document.removeEventListener('mousemove',move);document.removeEventListener('click',click,true);
      if(hl){hl.remove();hl=null;}document.body.style.cursor='';
    }
  });
})();`;

export const INJECT_TAG = `<script data-bt-devtools="1">${DEVTOOLS_SCRIPT}</script>`;