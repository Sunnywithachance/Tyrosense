import {test,expect} from '@playwright/test';

test('journal plots saved tests for the selected lesion in date order',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Start a new test'})).toBeVisible();
  await page.evaluate(async()=>{
    const {compareRGB}=await import('/analysis.js');
    const lesions=['Shoulder','Arm','Back'].map((name,index)=>({
      id:`lesion-${index}`,name,location:name,photos:[],
    }));
    const reading=(lesionIndex,day,distance)=>{
      const before={rgb:[140,140,140]};
      const after={rgb:[140-distance,140,140]};
      return {
        id:`test-${lesionIndex}-${day}`,lesionId:lesions[lesionIndex].id,
        createdAt:Date.UTC(2026,10,day,12),elapsedMinutes:60,before,after,
        comparison:compareRGB(before.rgb,after.rgb),
      };
    };
    const results=[reading(0,18,20),reading(0,15,10),reading(1,16,5),reading(0,17,30)];
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('tyrosense',1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction('data','readwrite');
        tx.objectStore('data').put({lesions,results,duration:60},'workspace');
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>reject(tx.error);
      };
    });
  });
  await page.reload();
  await page.getByRole('button',{name:/Lesion journal/}).click();
  const chart=page.getByRole('region',{name:'Colour shift over time'});

  await page.getByRole('button',{name:/Shoulder/}).click();
  await expect(page.getByRole('button',{name:/Shoulder.*Colour shift 30\.0/})).toBeVisible();
  await expect(chart.getByRole('button')).toHaveText(['10.0','30.0','20.0']);
  await expect(chart.locator('polyline')).toBeVisible();
  await chart.getByRole('button',{name:/colour shift of 30\.0/}).click();
  await expect(page.getByRole('heading',{name:'Patch comparison'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Colour shift',exact:true})).toBeVisible();
  await expect(page.locator('.metric')).toHaveText('30.0');
  await page.getByRole('button',{name:'Back to lesion',exact:true}).click();
  await expect(chart.getByRole('button')).toHaveCount(3);

  await page.getByRole('button',{name:'Back to lesions',exact:true}).click();
  await page.getByRole('button',{name:/Arm/}).click();
  await expect(chart.getByRole('button')).toHaveText(['5.0']);
  await expect(chart.locator('polyline')).toHaveCount(0);

  await page.getByRole('button',{name:'Back to lesions',exact:true}).click();
  await page.getByRole('button',{name:/Back Back/}).click();
  await expect(page.getByText('No patch readings yet')).toBeVisible();
  await expect(chart).toHaveCount(0);
});
