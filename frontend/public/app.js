import {api,fileToDataUrl,session} from "./client.js";
import {authTemplate,shellTemplate,homeTemplate,createTemplate,historyTemplate,supportTemplate,settingsTemplate,resultTemplate} from "./templates.js";

const root=document.querySelector("#app"),toastRoot=document.querySelector("#toast-root");
const state={user:null,projects:[],capability:null,route:"home",authMode:"login",collapsed:localStorage.getItem("acs_sidebar_collapsed")==="true",mobileOpen:false,currentResult:null,files:[]};
const routeFromHash=()=>location.hash.replace(/^#\//,"").split("/")[0]||"home";
function toast(message,type="success"){const node=document.createElement("div");node.className=`toast ${type}`;node.dataset.testid="app-toast";node.textContent=message;toastRoot.append(node);setTimeout(()=>node.remove(),3500);}

async function loadWorkspace(){
  const [projects,capability]=await Promise.all([api("/api/projects"),api("/api/capabilities/video")]);
  state.projects=projects.projects;state.capability=capability;
}
async function bootstrap(){
  if(session.token){try{state.user=(await api("/api/auth/me")).user;await loadWorkspace();}catch{session.token=null;}}
  state.route=routeFromHash();render();
}
function content(){
  if(state.route==="create")return createTemplate(state.capability,state.user.preferences?.language,state.currentResult);
  if(state.route==="history")return historyTemplate(state.projects);
  if(state.route==="support")return supportTemplate();
  if(state.route==="settings")return settingsTemplate(state.user);
  return homeTemplate(state.projects,state.capability);
}
function render(){
  root.innerHTML=state.user?shellTemplate({...state,content:content()}):authTemplate(state.authMode);
  bind();
}
function bind(){
  document.querySelector("#auth-mode-toggle")?.addEventListener("click",()=>{state.authMode=state.authMode==="login"?"register":"login";render();});
  document.querySelector("#auth-form")?.addEventListener("submit",handleAuth);
  document.querySelector("#nav-toggle")?.addEventListener("click",()=>{state.collapsed=!state.collapsed;localStorage.setItem("acs_sidebar_collapsed",state.collapsed);render();});
  document.querySelector("#mobile-menu")?.addEventListener("click",()=>{state.mobileOpen=true;render();});
  document.querySelector("#mobile-overlay")?.addEventListener("click",()=>{state.mobileOpen=false;render();});
  document.querySelector("#logout-btn")?.addEventListener("click",handleLogout);
  document.querySelector("#create-form")?.addEventListener("submit",handleCreate);
  document.querySelector("#product-images")?.addEventListener("change",handleImages);
  document.querySelector('[name="preset"]')?.addEventListener("change",event=>document.querySelector("#custom-preset-field")?.classList.toggle("hidden",event.target.value!=="custom"));
  document.querySelectorAll(".restore-project").forEach(button=>button.addEventListener("click",()=>restoreProject(button.dataset.id)));
  document.querySelectorAll(".delete-project").forEach(button=>button.addEventListener("click",()=>deleteProject(button.dataset.id)));
  document.querySelector("#copy-package")?.addEventListener("click",copyPackage);
  document.querySelector("#download-project")?.addEventListener("click",downloadProject);
  document.querySelector("#settings-form")?.addEventListener("submit",saveSettings);
}
async function handleAuth(event){
  event.preventDefault();const button=event.target.querySelector("button[type=submit]"),data=Object.fromEntries(new FormData(event.target));button.disabled=true;button.textContent="Please wait…";
  try{const response=await api(`/api/auth/${event.target.dataset.mode}`,{method:"POST",body:JSON.stringify(data)});session.token=response.token;state.user=response.user;await loadWorkspace();location.hash="#/home";state.route="home";render();toast(event.target.dataset.mode==="login"?"Welcome back.":"Your workspace is ready.");}catch(error){toast(error.message,"error");button.disabled=false;render();}
}
async function handleLogout(){try{await api("/api/auth/logout",{method:"POST"});}catch{}session.token=null;state.user=null;state.projects=[];state.currentResult=null;location.hash="";render();}
async function handleImages(event){state.files=[...event.target.files].slice(0,6);const preview=document.querySelector("#image-preview");preview.innerHTML=state.files.map((file,index)=>`<span data-testid="product-image-${index+1}">${file.name}</span>`).join('');}
async function handleCreate(event){
  event.preventDefault();const button=event.target.querySelector('[data-testid="btn-generate-content"]');button.disabled=true;button.innerHTML='<span class="spinner"></span> Building campaign';
  try{const form=Object.fromEntries(new FormData(event.target));form.productImages=await Promise.all(state.files.map(fileToDataUrl));form.targetDurationSeconds=Number(form.targetDurationSeconds);const started=await api("/api/generation-jobs",{method:"POST",body:JSON.stringify(form)});toast("Generation started. You can keep this page open.");await pollGeneration(started.id);}catch(error){toast(error.message,"error");button.disabled=false;button.textContent="Generate campaign";}
}
async function pollGeneration(id){
  for(let attempt=0;attempt<310;attempt+=1){
    const {job}=await api(`/api/generation-jobs/${id}`);
    if(job.status==="completed"){state.currentResult=job.result;state.projects.unshift(job.result);render();document.querySelector("#generation-result")?.scrollIntoView({behavior:"smooth",block:"start"});toast("Campaign generated and archived.");return;}
    if(job.status==="failed")throw new Error(job.error||"Generation failed.");
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  throw new Error("Generation is still processing. It will remain available in History when complete.");
}
async function restoreProject(id){try{state.currentResult=await api(`/api/projects/${id}`);state.route="create";location.hash="#/create";render();setTimeout(()=>document.querySelector("#generation-result")?.scrollIntoView({behavior:"smooth"}),50);toast("Stored project restored without regeneration.");}catch(error){toast(error.message,"error");}}
async function deleteProject(id){if(!confirm("Delete this archived project?"))return;try{await api(`/api/projects/${id}`,{method:"DELETE"});state.projects=state.projects.filter(item=>item.project.id!==id);render();toast("Project deleted.");}catch(error){toast(error.message,"error");}}
async function copyPackage(){const pkg=state.currentResult?.affiliatePackage;if(!pkg)return;const text=`${pkg.productName}\n\n${pkg.productDescription}\n\n${pkg.caption}\n\n${pkg.cta}\n\n${pkg.hashtags.join(" ")}`;await navigator.clipboard.writeText(text);toast("Affiliate package copied.");}
async function downloadProject(){
  if(!state.currentResult)return;
  try{
    const exported=await api(`/api/projects/${state.currentResult.project.id}/export`),blob=new Blob([JSON.stringify(exported,null,2)],{type:"application/json"}),link=document.createElement("a"),objectUrl=URL.createObjectURL(blob);
    link.href=objectUrl;link.download=`${state.currentResult.project.projectName.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.json`;document.body.append(link);link.click();
    setTimeout(()=>{link.remove();URL.revokeObjectURL(objectUrl);},1000);
  }catch(error){toast(error.message,"error");}
}
async function saveSettings(event){event.preventDefault();try{const language=new FormData(event.target).get("language");state.user=(await api("/api/settings",{method:"PATCH",body:JSON.stringify({language})})).user;render();toast("Preferences saved.");}catch(error){toast(error.message,"error");}}
window.addEventListener("hashchange",()=>{if(!state.user)return;state.route=routeFromHash();state.mobileOpen=false;if(state.route!=="create")state.currentResult=null;render();});
bootstrap();