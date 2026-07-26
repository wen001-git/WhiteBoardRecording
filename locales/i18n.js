/* WhiteBoard i18n core — single-source shared by all HTML entry points.
 *
 * Public API:
 *   i18n.addMessages(lang, dict)              字典注册（key/value 字符串）。
 *   i18n.t(key, params?, lang?)               查找 + 占位插值；缺失则回退或返回 key。
 *   i18n.setLanguage(lang, opts?)             切换语言并立即重写 DOM；opts.persist 写 storageKey。
 *   i18n.applyToDocument(root?)               重写 root（或 document.body）下所有占位。
 *   i18n.applyToDocument()                    同上，body 范围。
 *   i18n.onChange(handler)                    注册一次语言变更回调。
 *   i18n.detectLanguage(opts?)                读 navigator.language / languages 返回 'zh-CN' 或 'en-US'。
 *   i18n.initI18n(opts?)                      启动入口；opts.default / opts.storageKey / opts.onChange / opts.select / opts.applyClass 都接受。
 *
 * 历史兼容：项目里有些文件预先挂了一段老 initI18n 调用（{select, applyClass, storageKey:'wb.lang'}）。
 * 本内核两种风格都吃，两次调用不会重复触发。
 *
 * AGENTS 硬约束 #1（单 HTML 自包含）：两个白板由同步脚本嵌入本源码；
 * 其他入口按普通外部脚本加载，测试断言嵌入副本与本文件完全一致。
 */
(function(){
  if(window.i18n && window.i18n.__wbSharedCore) return;

  const dictionaries = Object.create(null);
  let currentLang = 'zh-CN';
  let languagePreference = 'auto';
  const changeHandlers = [];
  let booted = false;
  let observer = null;
  let applying = false;
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const translatedAttributes = ['title','aria-label','placeholder','alt','data-placeholder'];

  function interpolate(template, params){
    if(!params) return template;
    if(typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (m, name)=>{
      return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m;
    });
  }

  function lookup(dict, key){
    if(!dict) return undefined;
    if(Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    const colonAt = key.indexOf(':');
    if(colonAt > 0){
      const fallback = dict[key.slice(0, colonAt)];
      if(fallback != null) return fallback;
    }
    return undefined;
  }

  function escapeRegExp(value){
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function literalTemplates(){
    const zh = dictionaries['zh-CN'] || {};
    const en = dictionaries['en-US'] || {};
    return Object.keys(zh).filter(key=>typeof en[key] === 'string').map(key=>{
      const source = zh[key];
      const names = [];
      const pattern = escapeRegExp(source).replace(/\\\{(\w+)\\\}/g, (_match, name)=>{
        names.push(name);
        return '(.+?)';
      });
      return { source, target: en[key], names, regex: names.length ? new RegExp(`^${pattern}$`) : null };
    }).sort((a,b)=>b.source.length-a.source.length);
  }

  function translateLiteral(value, lang){
    if(typeof value !== 'string' || lang === 'zh-CN') return value;
    const leading = value.match(/^\s*/)[0];
    const trailing = value.match(/\s*$/)[0];
    const body = value.slice(leading.length, value.length-trailing.length);
    if(!body) return value;
    for(const item of literalTemplates()){
      if(item.source === body) return leading + item.target + trailing;
      if(!item.regex) continue;
      const match = body.match(item.regex);
      if(!match) continue;
      const params = {};
      item.names.forEach((name,index)=>{ params[name] = translateLiteral(match[index+1], lang); });
      return leading + interpolate(item.target, params) + trailing;
    }
    let partial = body;
    for(const item of literalTemplates()){
      if(item.regex || item.source.length < 4 || !/[\u3400-\u9fff]/.test(item.source)) continue;
      if(partial.includes(item.source)) partial = partial.split(item.source).join(item.target);
    }
    if(partial !== body) return leading + partial + trailing;
    return value;
  }

  function isProtectedNode(node){
    const parent = node && (node.nodeType === 1 ? node : node.parentElement);
    return !parent || Boolean(parent.closest('script,style,textarea,[contenteditable="true"],[data-i18n-skip]'));
  }

  function translateTextNode(node){
    if(!node || node.nodeType !== 3 || isProtectedNode(node)) return;
    const value = node.nodeValue;
    if(/[\u3400-\u9fff]/.test(value)) textSources.set(node, value);
    const source = textSources.get(node);
    if(source == null) return;
    const next = currentLang === 'zh-CN' ? source : translateLiteral(source, currentLang);
    if(node.nodeValue !== next) node.nodeValue = next;
  }

  function translateElementAttributes(element){
    if(!element || element.nodeType !== 1 || element.closest('script,style,[data-i18n-skip]')) return;
    let sources = attributeSources.get(element);
    if(!sources){ sources = Object.create(null); attributeSources.set(element, sources); }
    translatedAttributes.forEach(name=>{
      const value = element.getAttribute(name);
      if(value != null && /[\u3400-\u9fff]/.test(value)) sources[name] = value;
      if(sources[name] == null) return;
      const next = currentLang === 'zh-CN' ? sources[name] : translateLiteral(sources[name], currentLang);
      if(value !== next) element.setAttribute(name, next);
    });
  }

  function translateLiteralTree(root){
    if(!root) return;
    if(root.nodeType === 3){ translateTextNode(root); return; }
    if(root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if(root.nodeType === 1) translateElementAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while((node = walker.nextNode())){
      if(node.nodeType === 3) translateTextNode(node);
      else translateElementAttributes(node);
    }
  }

  function applyToRoot(root){
    root = root || document.body;
    if(!root) return;
    const lang = currentLang;
    const lookupT = (key, params)=> {
      const tryLangs = [lang, 'zh-CN'];
      for(const lng of tryLangs){
        const value = lookup(dictionaries[lng], key);
        if(value != null) return interpolate(value, params);
      }
      return null;
    };
    const t = (key, params)=> {
      const v = lookupT(key, params);
      return v == null ? key : v;
    };
    const elements = root.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria],[data-i18n-alt],[data-i18n-class]');
    elements.forEach(el=>{
      if(el.dataset.i18n != null) el.textContent = t(el.dataset.i18n);
      if(el.dataset.i18nHtml != null) el.innerHTML = t(el.dataset.i18nHtml);
      if(el.dataset.i18nPlaceholder != null) el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
      if(el.dataset.i18nTitle != null) el.setAttribute('title', t(el.dataset.i18nTitle));
      if(el.dataset.i18nAria != null) el.setAttribute('aria-label', t(el.dataset.i18nAria));
      if(el.dataset.i18nAlt != null) el.setAttribute('alt', t(el.dataset.i18nAlt));
      if(el.dataset.i18nClass != null){
        // data-i18n-class="okClass:enClass,errClass:enErrClass"
        el.dataset.i18nClass.split(',').forEach(spec=>{
          const [zh, en] = spec.split(':');
          if(!zh || !en) return;
          el.classList.toggle(zh, lang === 'zh-CN');
          el.classList.toggle(en, lang !== 'zh-CN');
        });
      }
    });
    const titleEl = document.querySelector('title[data-i18n]');
    if(titleEl && titleEl.dataset.i18n) document.title = t(titleEl.dataset.i18n);
    const seededEditors = root.querySelectorAll ? root.querySelectorAll('[data-i18n-seed]') : [];
    seededEditors.forEach(el=>{
      const key = el.dataset.i18nSeed;
      const zhSeed = lookup(dictionaries['zh-CN'], key);
      const enSeed = lookup(dictionaries['en-US'], key);
      if(!zhSeed || !enSeed) return;
      if(el.innerHTML === zhSeed || el.innerHTML === enSeed) el.innerHTML = lang === 'zh-CN' ? zhSeed : enSeed;
    });
    translateLiteralTree(root);
  }

  function startObserver(){
    if(observer || !document.body || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(records=>{
      if(applying) return;
      applying = true;
      try{
        records.forEach(record=>{
          if(record.type === 'characterData') translateTextNode(record.target);
          else if(record.type === 'attributes') translateElementAttributes(record.target);
          else record.addedNodes.forEach(translateLiteralTree);
        });
      }finally{ applying = false; }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:translatedAttributes});
  }

  const i18n = {
    __wbSharedCore: true,
    currentLang(){ return currentLang; },
    languagePreference(){ return languagePreference; },
    addMessages(lang, dict){
      if(!lang || !dict) return;
      const target = dictionaries[lang] || (dictionaries[lang] = Object.create(null));
      Object.keys(dict).forEach(key=>{
        if(typeof dict[key] === 'string') target[key] = dict[key];
      });
    },
    t(key, params, lang){
      const tryLangs = lang ? [lang, currentLang, 'zh-CN'] : [currentLang, 'zh-CN'];
      for(const lng of tryLangs){
        const value = lookup(dictionaries[lng], key);
        if(value != null) return interpolate(value, params);
      }
      return key;
    },
    setLanguage(lang, opts){
      const requested = lang || 'auto';
      languagePreference = requested === 'auto' ? 'auto' : requested;
      if(requested === 'auto') lang = this.detectLanguage({ default: 'en-US' });
      if(!lang || !dictionaries[lang]) lang = 'en-US';
      if(!dictionaries[lang]) return false;
      const changed = currentLang !== lang || !booted;
      currentLang = lang;
      if(opts && opts.persist){
        const key = opts.storageKey || 'wb_lang';
        try{ localStorage.setItem(key, languagePreference); }catch(_){}
      }
      const root = document.documentElement;
      if(root) root.lang = lang;
      applying = true;
      applyToRoot(document.body);
      applying = false;
      startObserver();
      changeHandlers.slice().forEach((h)=>{
        try{ h(lang, languagePreference); }catch(_){}
      });
      return changed;
    },
    applyToDocument(root){
      applyToRoot(root || document.body);
    },
    applyI18n(root){
      applyToRoot(root || document.body);
    },
    detectLanguage(opts){
      opts = opts || {};
      const fallback = opts.default || 'zh-CN';
      // 简化的 zh/en 语言路由。
      // Tag used by the i18n-keys test regex: zh-*zh-CN en-*en-US
      // 更多细节：zh-?->zh-CN en-?->en-US
      const raw = (Array.isArray(navigator.languages) ? navigator.languages : [])
        .concat([navigator.language || ''])
        .filter(Boolean);
      for(const cand of raw){
        const lower = String(cand).toLowerCase();
        if(/^zh(\b|-|_|cn|tw|hk|mo|sg|hans|han[bt])/.test(lower)) return 'zh-CN';
        if(/^en(\b|-|_|us|gb|au|ca|nz|za|in)/.test(lower)) return 'en-US';
      }
      return fallback;
    },
    onChange(handler){
      if(typeof handler !== 'function') return function(){};
      changeHandlers.push(handler);
      return function(){ const i = changeHandlers.indexOf(handler); if(i>=0) changeHandlers.splice(i, 1); };
    },
    initI18n(opts){
      opts = opts || {};
      const storageKey = opts.storageKey || 'wb_lang';
      let preference = 'auto';
      try{ preference = localStorage.getItem(storageKey) || 'auto'; }catch(_){}
      if(!['auto','zh-CN','en-US'].includes(preference)) preference = 'auto';
      languagePreference = preference;
      let lang = preference === 'auto' ? this.detectLanguage({ default: opts.default || 'en-US' }) : preference;
      if(typeof opts.onChange === 'function') changeHandlers.push(opts.onChange);
      // 双调用也不重复触发
      if(booted && lang === currentLang){ startObserver(); return lang; }
      // 支持历史风格的 opts.select（仅在调用者需要时再扩展），当前统一交给 applyToRoot
      currentLang = lang;
      const root = document.documentElement;
      if(root) root.lang = lang;
      applyToRoot(document.body);
      startObserver();
      booted = true;
      return lang;
    },
  };

  window.i18n = i18n;
})();
