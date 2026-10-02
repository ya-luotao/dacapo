// The reader's dictionary, asked for beside the app's script. Every dictionary is a chunk loaded
// on demand (locale.ts), and the app asks for the one in effect only once its own script runs:
// one request after all the others. So the built page carries a few lines that decide the
// language as `preferredLocale()` will (the stored choice, else `?lang=`, else the browser's
// language) and name that dictionary as a `modulepreload`, which the browser then fetches with
// the rest; the app's `import()` finds it there. vite.config.ts writes the lines into the built
// page with the names the build gave the chunks. A wrong guess costs a download and nothing
// else: the app still loads the dictionary it decides on.
//
// Nothing is imported here: vite.config.ts reads this file, where there is no browser.

/** The tag for one dictionary: as Vite writes its own, so the page names the file as an `href`. */
export function dictionaryLink(address: string): string {
  return `<link rel="modulepreload" crossorigin href="${address}">`;
}

/** An address that can stand in the page's script as it is: nothing to escape, nothing to end the script. */
const PLAIN_ADDRESS = /^[\w.:/~-]+$/;

/**
 * The script for the built page, or null when it cannot be written: a language without an address,
 * or an address that would need escaping.
 * @param addresses each language's dictionary, as the page can ask for it (below the base path)
 */
export function dictionaryPreloadScript(
  addresses: Readonly<Record<string, string>>,
): string | null {
  const locales = Object.keys(addresses);
  if (locales.length === 0) return null;
  if (!locales.every((locale) => PLAIN_ADDRESS.test(addresses[locale]!))) return null;
  // Each tag whole and in single quotes: the offline worker reads the page's `href`s, and holds
  // every file under assets/ among them to its list (`pageBelongs` in offline/route.ts).
  const links = locales
    .map((locale) => `${JSON.stringify(locale)}:'${dictionaryLink(addresses[locale]!)}'`)
    .join(',');
  return (
    `(function(){try{var d={${links}},l=null,q,k,s,p;` +
    // The choice kept (`readLocaleOverride`).
    'try{l=localStorage.getItem("dacapo.locale")}catch(e){}' +
    'if(!d.hasOwnProperty(l)){l=null;' +
    // A language the address asks for (`adoptLanguage` in langParam.ts).
    'q=new URLSearchParams(location.search).get("lang");' +
    'if(q!==null){q=q.toLowerCase();for(k in d)if(l===null&&k.toLowerCase()===q)l=k}' +
    // The browser's language (`detectLocale`).
    'if(l===null){s=(navigator.language||"").toLowerCase().split(/[-_]/);p=s[0];' +
    'l=p==="ja"?"ja":p==="ko"?"ko":p!=="zh"?"en":' +
    's.indexOf("hant")>0?"zh-TW":s.indexOf("hans")>0?"zh-CN":' +
    's.indexOf("tw")>0||s.indexOf("hk")>0||s.indexOf("mo")>0?"zh-TW":"zh-CN"}}' +
    'if(d.hasOwnProperty(l))document.head.insertAdjacentHTML("beforeend",d[l])' +
    '}catch(e){}})()'
  );
}
