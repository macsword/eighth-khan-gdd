// usage: node shoot.js <url>   -> shot_mobile.png, shot_desktop.png + checks
const puppeteer = require('/workspace/ekbuild/node_modules/puppeteer-core');
(async () => {
  const url = process.argv[2];
  const b = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
  const res = {};
  for (const [name, w, h, mob] of [['mobile', 390, 844, true], ['desktop', 1440, 900, false]]) {
    const p = await b.newPage();
    await p.setViewport({width: w, height: h, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob});
    await p.goto(url, {waitUntil: 'networkidle0', timeout: 60000}); await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});
    await p.evaluate(() => document.fonts.ready);
    res[name] = await p.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth > window.innerWidth,
      sections: document.querySelectorAll('section.sec h2[id^="s"]').length,
      tables: document.querySelectorAll('.table-wrap table').length,
      vazir: document.fonts.check('16px Vazirmatn', 'خان'),
      loadedFaces: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).slice(0, 6),
      wideOffenders: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return (r.right > window.innerWidth + 1 || r.left < -1) && !e.closest('.table-wrap') && !e.closest('.toc') && !e.closest('pre'); }).slice(0, 5).map(e => e.tagName + '.' + e.className),
    }));
    await p.screenshot({path: `shot_${name}.png`});
    if (mob) {
      await p.evaluate(() => document.getElementById('s7').scrollIntoView({behavior:'instant'}));
      await new Promise(r => setTimeout(r, 400));
      await p.screenshot({path: 'shot_mobile_table.png'});
      await p.click('#tocBtn'); await new Promise(r => setTimeout(r, 400));
      await p.screenshot({path: 'shot_mobile_toc.png'});
    } else {
      await p.evaluate(() => document.getElementById('s16').scrollIntoView({behavior:'instant'}));
      await new Promise(r => setTimeout(r, 400));
      await p.screenshot({path: 'shot_desktop_s16.png'});
    }
    await p.close();
  }
  // dark mode quick shot
  const p = await b.newPage();
  await p.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'dark'}]);
  await p.setViewport({width: 390, height: 844, deviceScaleFactor: 2, isMobile: true});
  await p.goto(url, {waitUntil: 'networkidle0'});
  await p.evaluate(() => document.getElementById('s4').scrollIntoView({behavior:'instant'}));
  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({path: 'shot_mobile_dark.png'});
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
