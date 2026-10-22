import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await p.goto('http://localhost:5181'); await p.waitForTimeout(8000);
await p.waitForTimeout(6000); await p.keyboard.press('Space'); await p.waitForTimeout(4000);
await p.click('.race-tile'); await p.waitForTimeout(2500);
await p.locator('button.cta:visible').first().click(); await p.waitForTimeout(25000);
const d='D:/RaceUltimate/track-viewer/qa/camera-apex/';
await p.waitForTimeout(15000);
const shot=async(n)=>p.screenshot({ path: d+n+'.png' });
await p.keyboard.down('KeyW');
await p.waitForFunction(()=>{const m=document.body.innerText.match(/0:0(\d)\.\d{3}/);return m&&+m[1]>=Number(6);},null,{timeout:60000});
await p.keyboard.up('KeyW'); await p.keyboard.down('KeyS'); await p.waitForTimeout(2100);
await p.keyboard.up('KeyS'); await p.keyboard.down('KeyW'); await p.waitForTimeout(Number(process.argv[2]??300)); await p.keyboard.down('KeyD');
for (let i=0;i<5;i++){ await p.waitForTimeout(450); await shot('corner-'+i); }
await p.keyboard.down('Space');
for (let i=0;i<3;i++){ await p.waitForTimeout(400); await shot('slide-'+i); }
await b.close();
