import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await p.goto('http://127.0.0.1:5180'); await p.waitForTimeout(6000);
await p.keyboard.press('Enter'); await p.waitForTimeout(3000);
for (let i=0;i<5;i++){
 console.log(i, await p.evaluate(()=>[...document.querySelectorAll('button,[role=button],a')].filter(x=>x.offsetParent).map(x=>x.textContent.trim().slice(0,30)).slice(0,14)));
 await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
}
await p.screenshot({path:'D:/RaceUltimate/track-viewer/qa/camera-apex/nav.png'});
await b.close();
