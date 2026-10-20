import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:4180';const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);await expect(page.getByRole('heading',{level:1})).toContainText('One way through');await expect.poll(()=>page.locator('.hero-image img').evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);await page.screenshot({path:'.local/docs-desktop.png',fullPage:true});
 const links=await page.locator('a[href^="/"]').evaluateAll(elements=>elements.map(e=>e.getAttribute('href')!));
 for(const url of new Set(links)){const r=await fetch(base+url);if(!r.ok)throw new Error('Docs link '+url+' '+r.status);}
 await page.goto(base+'/playground');await page.getByLabel('Quality',{exact:true}).selectOption('50');await page.getByLabel('Preferred source').selectOption('webp');await page.getByLabel('Priority preload').check();await expect(page.getByTestId('playground-image')).toHaveAttribute('loading','eager');await page.getByLabel('Provider',{exact:true}).selectOption('cloudinary');await expect(page.getByTestId('provider-url')).toContainText('res.cloudinary.com/demo');
 await page.goto(base+'/docs/getting-started');await page.getByLabel('Find a guide').fill('security');await expect(page.locator('.docs-sidebar nav a')).toHaveCount(1);await expect(page.locator('.docs-sidebar nav a')).toContainText('Security');
 await page.setViewportSize({width:390,height:844});await page.goto(base);await expect(page.getByRole('heading',{level:1})).toBeVisible();if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw new Error('Horizontal overflow');await page.screenshot({path:'.local/docs-mobile.png',fullPage:true});
 expect(errors).toEqual([]);await writeFile('.local/m10-docs-smoke.json',JSON.stringify({status:'passed',internalHomeLinks:links.length,desktop:[1440,1000],mobile:[390,844],browserErrors:errors,playground:['quality','format','priority','provider-url'],search:'guide titles'},null,2)+'\n');
}finally{await browser.close();}
