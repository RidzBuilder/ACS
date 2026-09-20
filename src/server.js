import http from "node:http";
import crypto from "node:crypto";
import {createReadStream} from "node:fs";
import {readFile,writeFile,mkdir,stat} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {extname,join,normalize} from "node:path";
import {executeGoldenPath,resolveVideoCapability} from "./domain.js";

const port = Number(process.env.PORT);
if (!port) throw new Error("PORT is required");
const dataFile = process.env.ACS_DATA_FILE;
const publicApiBase = process.env.REACT_APP_BACKEND_URL;
if (!dataFile) throw new Error("ACS_DATA_FILE is required");
if (!publicApiBase) throw new Error("REACT_APP_BACKEND_URL is required");
const publicDir = fileURLToPath(new URL("../frontend/public",import.meta.url));
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp4":"video/mp4",".webm":"video/webm"};

async function loadState(){
  try {
    const parsed=JSON.parse(await readFile(dataFile,"utf8"));
    if(parsed.users&&parsed.sessions&&parsed.projects)return {...parsed,jobs:parsed.jobs||{}};
    return {users:{},sessions:{},projects:parsed||{},jobs:{}};
  } catch { return {users:{},sessions:{},projects:{},jobs:{}}; }
}
async function saveState(state){await mkdir(new URL("../.data",import.meta.url),{recursive:true});await writeFile(dataFile,JSON.stringify(state,null,2));}
function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}
function readBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",chunk=>{raw+=chunk;if(raw.length>12_000_000)reject(new Error("Payload too large"));});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});}
function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){return {salt,hash:crypto.pbkdf2Sync(password,salt,120000,32,"sha256").toString("hex")};}
function safeUser(user){return {id:user.id,name:user.name,email:user.email,preferences:user.preferences||{language:"en"}};}
function tokenFrom(req){return req.headers.authorization?.startsWith("Bearer ")?req.headers.authorization.slice(7):null;}
async function currentUser(req,state){const session=state.sessions[tokenFrom(req)];return session?state.users[session.userId]:null;}
function routeId(path){const match=path.match(/^\/api\/projects\/([^/]+)$/);return match?.[1];}

async function serveStatic(req,path,res){
  const requested=path==="/"?"index.html":path.replace(/^\//,"");
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,"");
  const target=join(publicDir,safe);
  try {
    const details=await stat(target),contentType=mime[extname(target)]||"application/octet-stream",range=req.headers.range;
    if(req.method==="HEAD"){res.writeHead(200,{"content-type":contentType,"content-length":details.size,"accept-ranges":"bytes"});return res.end();}
    if(range){
      const match=range.match(/bytes=(\d*)-(\d*)/),start=match?.[1]?Number(match[1]):0,end=match?.[2]?Math.min(Number(match[2]),details.size-1):details.size-1;
      if(!match||start>end||start>=details.size){res.writeHead(416,{"content-range":`bytes */${details.size}`});return res.end();}
      res.writeHead(206,{"content-type":contentType,"content-length":end-start+1,"content-range":`bytes ${start}-${end}/${details.size}`,"accept-ranges":"bytes"});
      return createReadStream(target,{start,end}).pipe(res);
    }
    res.writeHead(200,{"content-type":contentType,"content-length":details.size,"accept-ranges":"bytes"});
    return createReadStream(target).pipe(res);
  } catch {}
  try {const body=await readFile(join(publicDir,"index.html"));res.writeHead(200,{"content-type":mime[".html"]});return res.end(body);} catch {return json(res,404,{error:"not found"});}
}

const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,"http://acs.local"), path=url.pathname;
  if(req.method==="GET"&&(path==="/health"||path==="/api/health"))return json(res,200,{ok:true,service:"acs-v3-runtime",version:"0.4.0"});
  if(req.method==="GET"&&path==="/config.js"){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});return res.end(`window.__ACS_CONFIG__=${JSON.stringify({apiRoot:publicApiBase})};`);}

  if(req.method==="POST"&&path==="/api/auth/register"){
    const input=await readBody(req),email=String(input.email||"").trim().toLowerCase(),password=String(input.password||""),name=String(input.name||"").trim();
    if(!name||!email.includes("@")||password.length<8)return json(res,400,{error:"Name, valid email, and password of at least 8 characters are required."});
    const state=await loadState();
    if(Object.values(state.users).some(user=>user.email===email))return json(res,409,{error:"An account with this email already exists."});
    const id=crypto.randomUUID(),secured=hashPassword(password),token=crypto.randomBytes(32).toString("hex");
    state.users[id]={id,name,email,passwordHash:secured.hash,passwordSalt:secured.salt,preferences:{language:"en"},createdAt:new Date().toISOString()};
    state.sessions[token]={userId:id,createdAt:new Date().toISOString()};await saveState(state);
    return json(res,201,{token,user:safeUser(state.users[id])});
  }
  if(req.method==="POST"&&path==="/api/auth/login"){
    const input=await readBody(req),email=String(input.email||"").trim().toLowerCase(),state=await loadState();
    const user=Object.values(state.users).find(candidate=>candidate.email===email);
    const secured=user?hashPassword(String(input.password||""),user.passwordSalt):null;
    if(!user||!crypto.timingSafeEqual(Buffer.from(secured.hash),Buffer.from(user.passwordHash)))return json(res,401,{error:"Invalid email or password."});
    const token=crypto.randomBytes(32).toString("hex");state.sessions[token]={userId:user.id,createdAt:new Date().toISOString()};await saveState(state);
    return json(res,200,{token,user:safeUser(user)});
  }

  const state=await loadState(),user=await currentUser(req,state);
  if(path.startsWith("/api/")&&!user)return json(res,401,{error:"Authentication required."});
  if(req.method==="GET"&&path==="/api/auth/me")return json(res,200,{user:safeUser(user)});
  if(req.method==="POST"&&path==="/api/auth/logout"){
    delete state.sessions[tokenFrom(req)];await saveState(state);return json(res,200,{ok:true});
  }
  if(req.method==="GET"&&path==="/api/capabilities/video"){
    const resolution=resolveVideoCapability();
    return json(res,200,{capability:resolution.capability,adapterContract:resolution.adapterContract,mode:resolution.mode,reason:resolution.reason||null,profile:resolution.profile});
  }
  if(req.method==="PATCH"&&path==="/api/settings"){
    const input=await readBody(req);user.preferences={...user.preferences,language:["en","id"].includes(input.language)?input.language:user.preferences.language};state.users[user.id]=user;await saveState(state);return json(res,200,{user:safeUser(user)});
  }
  if(req.method==="POST"&&path==="/api/projects"){
    const input=await readBody(req),result=await executeGoldenPath(input);result.ownerId=user.id;state.projects[result.project.id]=result;await saveState(state);return json(res,201,result);
  }
  if(req.method==="POST"&&path==="/api/generation-jobs"){
    const input=await readBody(req),jobId=crypto.randomUUID(),createdAt=new Date().toISOString();
    state.jobs[jobId]={id:jobId,ownerId:user.id,status:"running",createdAt,updatedAt:createdAt};await saveState(state);
    void executeGoldenPath(input).then(async result=>{
      const latest=await loadState();result.ownerId=user.id;latest.projects[result.project.id]=result;
      latest.jobs[jobId]={...latest.jobs[jobId],status:"completed",projectId:result.project.id,result,updatedAt:new Date().toISOString()};await saveState(latest);
    }).catch(async error=>{
      const latest=await loadState();latest.jobs[jobId]={...latest.jobs[jobId],status:"failed",error:error.message,updatedAt:new Date().toISOString()};await saveState(latest);
    });
    return json(res,202,{id:jobId,status:"running",createdAt});
  }
  const jobMatch=path.match(/^\/api\/generation-jobs\/([^/]+)$/);
  if(req.method==="GET"&&jobMatch){
    const job=state.jobs[jobMatch[1]];if(!job||job.ownerId!==user.id)return json(res,404,{error:"Generation job not found."});
    return json(res,200,{job});
  }
  if(req.method==="GET"&&path==="/api/projects"){
    const projects=Object.values(state.projects).filter(item=>item.ownerId===user.id).sort((a,b)=>b.project.createdAt.localeCompare(a.project.createdAt));
    return json(res,200,{projects});
  }
  const id=routeId(path);
  if(req.method==="GET"&&id){
    const result=state.projects[id];if(!result||result.ownerId!==user.id)return json(res,404,{error:"Project not found."});
    return json(res,200,{...result,execution:{...result.execution,restored:true}});
  }
  if(req.method==="DELETE"&&id){
    const result=state.projects[id];if(!result||result.ownerId!==user.id)return json(res,404,{error:"Project not found."});
    delete state.projects[id];await saveState(state);return json(res,200,{ok:true});
  }
  if(req.method==="GET"||req.method==="HEAD")return serveStatic(req,path,res);
  return json(res,404,{error:"not found"});
}catch(error){return json(res,400,{error:error.message});}});

server.listen(port,"0.0.0.0",()=>console.log(`ACS V3 runtime listening on :${port}`));