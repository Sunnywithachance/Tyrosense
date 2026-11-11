import {test,expect} from '@playwright/test';

async function mockCamera(page,{square=true}={}) {
  await page.addInitScript(({square})=>{
    window.cameraCalls=0;window.cameraTracks=[];window.cameraMode='normal';
    navigator.mediaDevices.getUserMedia=async()=>{
      window.cameraCalls++;
      if(window.cameraMode==='denied')throw new DOMException('Permission denied','NotAllowedError');
      if(window.cameraMode==='pending')await new Promise(resolve=>window.releaseCamera=resolve);
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=960;
      const ctx=canvas.getContext('2d');
      function draw(){ctx.fillStyle='#c7a68d';ctx.fillRect(0,0,640,960);if(square){ctx.fillStyle='#64432d';ctx.fillRect(195,355,250,250);}}
      draw();const timer=setInterval(draw,100),stream=canvas.captureStream(10);
      stream.getTracks().forEach(track=>{window.cameraTracks.push(track);const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};});
      return stream;
    };
  },{square});
}
async function baseline(page) {
  await page.goto('/');
  await page.getByRole('button',{name:'Start a new test'}).click();
  await page.getByRole('button',{name:'Register a new lesion'}).click();
  await page.getByLabel('Lesion name',{exact:true}).fill('Shoulder');
  await page.getByLabel('Body location').fill('Left shoulder');
  await page.getByRole('button',{name:'Save lesion',exact:true}).click();
  await page.getByRole('button',{name:'Continue to baseline photo'}).click();
  await page.getByRole('button',{name:'Capture baseline photo'}).click();
  await expect(page.getByRole('dialog',{name:'Capture before photo'})).toBeVisible();
}
async function enable(page){await page.getByRole('button',{name:'Enable camera',exact:true}).click();await expect(page.getByRole('button',{name:'Take patch photo'})).toBeEnabled();}
async function capture(page){await page.getByRole('button',{name:'Take patch photo'}).click();await expect(page.getByRole('button',{name:'Use photo',exact:true})).toBeVisible();}
async function expectStopped(page){await expect.poll(()=>page.evaluate(()=>window.cameraTracks.every(t=>t.readyState==='ended'))).toBe(true);}

test('requests camera only after Enable; detects square, reviews, retakes and saves both photos',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await mockCamera(page);await baseline(page);
  expect(await page.evaluate(()=>window.cameraCalls)).toBe(0);
  await enable(page);
  await expect(page.locator('.camera-detection')).toBeVisible();
  await expect(page.locator('.camera-status')).toHaveText(/Square candidate detected/);
  await page.screenshot({path:testInfo.outputPath('camera-preview.png')});
  await capture(page);await expectStopped(page);
  await expect(page.locator('.camera-review-copy')).toContainText('detected square');
  await page.getByRole('button',{name:'Retake',exact:true}).click();
  await expect(page.getByRole('button',{name:'Take patch photo'})).toBeEnabled();
  await expect(page.locator('.camera-detection')).toBeVisible();
  await capture(page);
  await page.getByRole('button',{name:'Use photo',exact:true}).click();
  await expect(page.locator('.camera-screen')).toHaveCount(0);
  await expect(page.locator('#before-photo img')).toBeVisible();
  await page.getByRole('button',{name:'Save baseline & start timer'}).click();
  await page.getByRole('button',{name:'Capture early for prototype testing'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Capture after photo'}).click();
  await enable(page);await capture(page);
  await page.getByRole('button',{name:'Use photo',exact:true}).click();
  await page.getByRole('button',{name:'Compare photos'}).click();
  await page.getByRole('button',{name:'Save to lesion history'}).click();
  await expect(page.getByText('Image colour difference')).toBeVisible();
  const saved=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('tyrosense',1);r.onsuccess=()=>{const q=r.result.transaction('data').objectStore('data').get('workspace');q.onsuccess=()=>resolve(q.result);};}));
  expect(saved.results).toHaveLength(1);expect(saved.current).toBeNull();
  expect(saved.results[0].before.capture.squareDetected).toBe(true);
  expect(saved.results[0].early).toBe(true);expect(saved.results[0].before.rgb).toHaveLength(3);
  await expectStopped(page);expect(errors).toEqual([]);
});

test('permission denial offers retry and a working library fallback',async({page})=>{
  await mockCamera(page);await baseline(page);await page.evaluate(()=>window.cameraMode='denied');
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('permission was not granted');
  await expect(page.getByRole('button',{name:'Take patch photo'})).toBeDisabled();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d').fillRect(0,0,100,100);return c.toDataURL().split(',')[1];});
  await page.locator('.camera-library input').setInputFiles({name:'patch.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.getByRole('button',{name:'Use photo',exact:true}).click();
  await expect(page.locator('#before-photo img')).toBeVisible();
});

test('manual capture stays available when no square is found, Escape stops camera',async({page})=>{
  await mockCamera(page,{square:false});await baseline(page);await enable(page);
  await expect(page.locator('.camera-detection')).toBeHidden();
  await capture(page);await expectStopped(page);
  await expect(page.locator('.camera-review-copy')).toContainText('No square was detected');
  await page.getByRole('button',{name:'Retake',exact:true}).click();
  await expect(page.getByRole('button',{name:'Take patch photo'})).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('.camera-screen')).toHaveCount(0);await expectStopped(page);
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
});

test('late permission resolution after closing never leaves a camera running',async({page})=>{
  await mockCamera(page);await baseline(page);await page.evaluate(()=>window.cameraMode='pending');
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseCamera)).toBe('function');
  await page.getByRole('button',{name:'Close camera',exact:true}).click();
  await page.evaluate(()=>window.releaseCamera());
  await expect.poll(()=>page.evaluate(()=>window.cameraTracks.length)).toBe(1);await expectStopped(page);
});

test('real getUserMedia API works with Chromium simulated hardware',async({page,context})=>{
  await context.grantPermissions(['camera']);await baseline(page);await enable(page);
  expect(await page.locator('video').evaluate(v=>v.videoWidth)).toBeGreaterThan(0);
  await capture(page);await page.getByRole('button',{name:'Use photo',exact:true}).click();
  await expect(page.locator('#before-photo img')).toBeVisible();
});


test('permission can be retried and backgrounding stops the stream until resumed',async({page})=>{
  await mockCamera(page);await baseline(page);await page.evaluate(()=>window.cameraMode='denied');
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('permission was not granted');
  await page.evaluate(()=>window.cameraMode='normal');await enable(page);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expectStopped(page);
  await expect(page.getByRole('button',{name:'Resume camera',exact:true})).toBeVisible();
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
  await page.getByRole('button',{name:'Resume camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Take patch photo'})).toBeEnabled();
  await page.getByRole('button',{name:'Close camera',exact:true}).click();await expectStopped(page);
});
