import {detectSquare,sameCandidate,coverRect,captureBounds} from './detection.js';

const glyph = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${({back:'M15 5l-7 7 7 7',flash:'M13 2L5 14h6l-1 8 9-13h-6z',flip:'M4 8h12l-3-3m7 11H8l3 3M4 8v8m16 0V8',image:'M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M16 8h.01',check:'M5 12l4 4L19 6',camera:'M4 7h4l2-3h4l2 3h4v13H4zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8'})[name]}"/></svg>`;

export function openCamera({kind,onCapture}) {
  if(document.querySelector('.camera-screen'))return;
  const trigger=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='camera-screen';
  dialog.setAttribute('aria-labelledby','camera-title');
  dialog.innerHTML=`
    <video class="camera-video" autoplay muted playsinline aria-label="Live camera preview"></video>
    <img class="camera-review" alt="Captured patch preview" hidden>
    <svg class="camera-overlay" aria-hidden="true"><path class="camera-guide"/><polygon class="camera-detection" hidden/></svg>
    <header class="camera-top">
      <button class="camera-icon" data-camera="close" aria-label="Close camera">${glyph('back')}</button>
      <div><p>PATCH CAPTURE · ${kind==='before'?'BASELINE':'REACTION'}</p><h2 id="camera-title">Capture ${kind==='before'?'before':'after'} photo</h2></div>
      <button class="camera-icon" data-camera="torch" aria-label="Toggle camera light" aria-pressed="false" hidden>${glyph('flash')}</button>
      <span class="camera-top-spacer"></span>
    </header>
    <section class="camera-permission">
      <div class="camera-permission-icon">${glyph('camera')}</div>
      <h2>Your patch,<br>in focus.</h2>
      <p class="camera-permission-copy">Allow camera access to line up your patch. The preview and detection run on your device; no video is uploaded.</p>
      <button class="primary" data-camera="enable">Enable camera</button>
      <p class="camera-error" role="alert"></p>
    </section>
    <footer class="camera-bottom">
      <div class="camera-live-info" hidden>
        <span class="camera-status" role="status">Align the square inside the guide</span>
        <p class="camera-tip">Even lighting. Keep the whole patch in view.</p>
        <p class="camera-detection-note">Square detection is an alignment aid, not patch identification.</p>
        <label class="camera-zoom" hidden>Zoom <input type="range" aria-label="Camera zoom"><output>1×</output></label>
      </div>
      <p class="camera-review-copy" hidden>Review the crop. Keep the reaction area clear and centred.</p>
      <div class="camera-controls">
        <label class="camera-icon camera-library" aria-label="Choose a photo from your library">${glyph('image')}<input type="file" accept="image/*" aria-label="Choose a photo from your library"></label>
        <button class="camera-shutter" data-camera="capture" aria-label="Take patch photo" disabled><span></span></button>
        <button class="camera-icon" data-camera="flip" aria-label="Switch camera" disabled>${glyph('flip')}</button>
      </div>
      <div class="camera-review-actions" hidden><button class="secondary" data-camera="retake">Retake</button><button class="primary" data-camera="use">${glyph('check')}Use photo</button></div>
      <p class="camera-footer-note">${kind==='before'?'Before photo · baseline':'After photo · reaction'}</p>
    </footer>`;
  const get=s=>dialog.querySelector(s);
  const video=get('video'),overlay=get('.camera-overlay'),polygon=get('.camera-detection');
  let stream=null,timer=null,generation=0,disposed=false,facing='environment',torch=false;
  let mode='permission',candidate=null,previous=null,stableFrames=0,lastDetectionAt=0;
  let captured=null,reviewURL=null,processing=false;
  const frame=document.createElement('canvas'),ctx=frame.getContext('2d',{willReadFrequently:true});
  const oldOverflow=document.body.style.overflow;
  document.body.append(dialog);
  document.body.style.overflow='hidden';
  dialog.showModal();

  function resetDetection(){
    candidate=null;previous=null;stableFrames=0;lastDetectionAt=0;polygon.setAttribute('hidden','');
    get('.camera-status').classList.remove('detected');
    get('.camera-status').textContent='Align the square inside the guide';
  }
  function stop(){
    generation++;
    clearTimeout(timer);timer=null;
    stream?.getTracks().forEach(track=>track.stop());stream=null;
    video.srcObject=null;torch=false;
    get('[data-camera="torch"]').hidden=true;
    get('.camera-top-spacer').hidden=false;
    get('.camera-zoom').hidden=true;
    get('[data-camera="capture"]').disabled=true;
    get('[data-camera="flip"]').disabled=true;
    resetDetection();
  }
  function setMode(next){
    mode=next;
    const live=next==='live',review=next==='review';
    get('.camera-permission').hidden=live||review;
    get('.camera-live-info').hidden=!live;
    get('.camera-review-actions').hidden=!review;
    get('.camera-review-copy').hidden=!review;
    get('.camera-controls').hidden=review;
    get('.camera-review').hidden=!review;
    overlay.toggleAttribute('hidden',!live);
    video.hidden=!live;
  }
  function showError(message){
    if(mode==='review'){get('.camera-review-copy').textContent=message;return;}
    if(mode==='live'){get('.camera-tip').textContent=message;return;}
    get('.camera-error').textContent=message;
    get('.camera-permission-copy').textContent='You can retry camera access or use the photo library below.';
  }
  function geometry(){
    const w=dialog.clientWidth,h=dialog.clientHeight;
    overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const r=captureBounds(null,w,h),c=22;
    get('.camera-guide').setAttribute('d',`M${r.x} ${r.y+c}v-${c-10}q0-10 10-10h${c-10} M${r.x+r.width-c} ${r.y}h${c-10}q10 0 10 10v${c-10} M${r.x+r.width} ${r.y+r.height-c}v${c-10}q0 10-10 10h-${c-10} M${r.x+c} ${r.y+r.height}h-${c-10}q-10 0-10-10v-${c-10}`);
    resetDetection();
  }
  const resize=new ResizeObserver(geometry);resize.observe(dialog);

  function scan(){
    if(disposed||mode!=='live'||!stream)return;
    if(video.readyState>=2&&video.videoWidth){
      const width=dialog.clientWidth,height=dialog.clientHeight;
      const scale=Math.min(1,224/Math.max(width,height));
      frame.width=Math.max(16,Math.round(width*scale));frame.height=Math.max(16,Math.round(height*scale));
      const source=coverRect(video.videoWidth,video.videoHeight,width,height);
      ctx.drawImage(video,source.x,source.y,source.width,source.height,0,0,frame.width,frame.height);
      const found=detectSquare(ctx.getImageData(0,0,frame.width,frame.height));
      stableFrames=sameCandidate(found,previous)?stableFrames+1:found?1:0;
      previous=found;
      candidate=stableFrames>=3?found:null;
      const locked=!!candidate;
      if(locked){
        lastDetectionAt=performance.now();
        polygon.setAttribute('points',candidate.corners.map(p=>`${p.x*width},${p.y*height}`).join(' '));
      }
      polygon.toggleAttribute('hidden',!locked);
      get('.camera-status').classList.toggle('detected',locked);
      const message=locked?'Square candidate detected · hold steady':'Align the square inside the guide';
      if(get('.camera-status').textContent!==message)get('.camera-status').textContent=message;
    }
    timer=setTimeout(scan,240);
  }

  async function enable(){
    if(processing||disposed)return;
    stop();setMode('permission');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      showError('Live camera needs HTTPS or localhost. Open the HTTPS Netlify address, or choose an image below.');return;
    }
    const request=++generation;
    get('[data-camera="enable"]').disabled=true;
    get('[data-camera="enable"]').textContent='Opening camera…';
    get('.camera-error').textContent='';
    try{
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}}});
      if(disposed||!dialog.open||request!==generation||document.hidden){next.getTracks().forEach(track=>track.stop());return;}
      stream=next;video.srcObject=stream;
      // playsinline + muted keep iPhone camera playback inside our custom UI.
      video.muted=true;await video.play();
      if(disposed||!dialog.open||request!==generation)return;
      setMode('live');geometry();
      get('[data-camera="capture"]').disabled=false;
      get('[data-camera="flip"]').disabled=false;
      const track=stream.getVideoTracks()[0];
      track.addEventListener('ended',()=>{if(!disposed&&mode==='live'){stop();setMode('permission');showError('Camera access ended. Tap Enable camera to reconnect.');}},{once:true});
      const caps=track.getCapabilities?.()||{};
      get('[data-camera="torch"]').hidden=!caps.torch;
      get('[data-camera="torch"]').setAttribute('aria-pressed','false');
      get('.camera-top-spacer').hidden=!!caps.torch;
      if(caps.zoom&&caps.zoom.max>caps.zoom.min){
        const input=get('.camera-zoom input');
        input.min=caps.zoom.min;input.max=Math.min(caps.zoom.max,4);input.step=caps.zoom.step||.1;input.value=track.getSettings().zoom||caps.zoom.min;
        get('.camera-zoom output').textContent=Number(input.value).toFixed(1)+'×';
        get('.camera-zoom').hidden=false;
      }
      scan();
    }catch(error){
      if(disposed||!dialog.open||request!==generation)return;
      stop();setMode('permission');
      const messages={NotAllowedError:'Camera permission was not granted. Allow it in this site’s browser settings, then retry, or choose a photo below.',NotFoundError:'No camera was found on this device. Choose a photo below.',NotReadableError:'The camera is busy or unavailable. Close other camera apps and retry.'};
      showError(messages[error.name]||'Unable to open this camera. Try again or choose a photo below.');
    }finally{
      if(!disposed&&request===generation||!disposed&&!stream){get('[data-camera="enable"]').disabled=false;get('[data-camera="enable"]').textContent='Enable camera';}
    }
  }

  function review(file,metadata){
    captured={file,metadata};
    if(reviewURL)URL.revokeObjectURL(reviewURL);
    reviewURL=URL.createObjectURL(file);get('.camera-review').src=reviewURL;
    stop();setMode('review');
    get('.camera-review-copy').textContent=metadata.source==='library'?'Review your photo. The centre 40% will be sampled.':metadata.squareDetected?'Review the crop around the detected square.':'Review the crop inside the guide. No square was detected.';
  }
  async function capture(){
    if(mode!=='live'||processing||!video.videoWidth)return;
    processing=true;get('[data-camera="capture"]').disabled=true;
    const request=generation;
    try{
      const w=dialog.clientWidth,h=dialog.clientHeight;
      const visible=coverRect(video.videoWidth,video.videoHeight,w,h);
      const match=performance.now()-lastDetectionAt<600?candidate:null;
      const bounds=captureBounds(match,w,h);
      const scale=visible.width/w;
      const source={x:visible.x+bounds.x*scale,y:visible.y+bounds.y*scale,width:bounds.width*scale,height:bounds.height*scale};
      const canvas=document.createElement('canvas');canvas.width=canvas.height=Math.max(1,Math.min(1200,Math.round(source.width)));
      canvas.getContext('2d').drawImage(video,source.x,source.y,source.width,source.height,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
      if(disposed||!dialog.open||request!==generation)return;
      if(!blob)throw Error('Unable to capture the frame. Please retry.');
      review(new File([blob],`tyrosense-${kind}.jpg`,{type:'image/jpeg'}),{source:'live-camera',squareDetected:!!match,corners:match?.corners||null,crop:source,capturedAt:Date.now()});
    }catch(error){if(!disposed){get('.camera-tip').textContent=error.message;get('[data-camera="capture"]').disabled=false;}}
    finally{processing=false;}
  }

  get('input[type="file"]').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    if(!file.type.startsWith('image/')||file.size>25*1024*1024){showError('Choose an image smaller than 25 MB.');return;}
    review(file,{source:'library',squareDetected:false,capturedAt:Date.now()});
    event.target.value='';
  });
  get('.camera-zoom input').addEventListener('change',async event=>{
    const track=stream?.getVideoTracks()[0];if(!track)return;
    try{await track.applyConstraints({advanced:[{zoom:Number(event.target.value)}]});get('.camera-zoom output').textContent=Number(event.target.value).toFixed(1)+'×';resetDetection();}
    catch{get('.camera-tip').textContent='Zoom is unavailable on this camera.';}
  });
  dialog.addEventListener('click',async event=>{
    const action=event.target.closest('[data-camera]')?.dataset.camera;if(!action||processing)return;
    event.stopPropagation();
    if(action==='close')dialog.close();
    if(action==='enable')await enable();
    if(action==='capture')await capture();
    if(action==='flip'){facing=facing==='environment'?'user':'environment';await enable();}
    if(action==='retake'){
      captured=null;if(reviewURL)URL.revokeObjectURL(reviewURL);reviewURL=null;
      get('.camera-review').removeAttribute('src');await enable();
    }
    if(action==='torch'){
      try{await stream?.getVideoTracks()[0].applyConstraints({advanced:[{torch:!torch}]});torch=!torch;get('[data-camera="torch"]').setAttribute('aria-pressed',String(torch));}
      catch{get('.camera-tip').textContent='Camera light is unavailable on this device.';}
    }
    if(action==='use'&&captured){
      processing=true;get('[data-camera="use"]').disabled=true;
      try{await onCapture(captured.file,captured.metadata);dialog.close();}
      catch(error){get('.camera-review-copy').textContent=error.message||'Unable to read this photo. Please retake or choose another.';}
      finally{processing=false;get('[data-camera="use"]').disabled=false;}
    }
  });
  function hide(){if(!document.hidden||disposed||mode==='review')return;stop();setMode('permission');get('[data-camera="enable"]').disabled=false;get('[data-camera="enable"]').textContent='Resume camera';}
  document.addEventListener('visibilitychange',hide);
  const leave=()=>{if(dialog.open)dialog.close();};
  window.addEventListener('pagehide',leave);
  dialog.addEventListener('close',()=>{
    disposed=true;stop();resize.disconnect();
    if(reviewURL)URL.revokeObjectURL(reviewURL);
    document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);
    document.body.style.overflow=oldOverflow;dialog.remove();
    if(trigger?.isConnected)trigger.focus({preventScroll:true});
    else document.getElementById(`${kind}-photo`)?.focus({preventScroll:true});
  },{once:true});
  geometry();setMode('permission');
}
