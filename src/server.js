import http from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {executeGoldenPath} from "./domain.js";
const port=Number(process.env.PORT||3000),dataDir=process.env.ACS_DATA_DIR||".data",file=process.env.ACS_DATA_FILE||dataDir+"/projects.json";
async function load(){try{return JSON.parse(await readFile(file,"utf8"));}catch{return {};}}
async function save(data){await mkdir(dataDir,{recursive:true});await writeFile(file,JSON.stringify(data,null,2));}
function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8"});res.end(JSON.stringify(body,null,2));}
function readBody(req){return new Promise((resolve,reject)=>{let data="";req.on("data",(chunk)=>{data+=chunk;if(data.length>1000000)reject(new Error("payload too large"));});req.on("end",()=>{try{resolve(data?JSON.parse(data):{});}catch{reject(new Error("invalid json"));}});req.on("error",reject);});}
const server=http.createServer(async(req,res)=>{try{
 if(req.method==="GET"&&req.url==="/health")return json(res,200,{ok:true,service:"acs-v3-runtime",capability:"real_ai_video_generation",adapterContract:"acs-video-adapter-v1",liveGeneratorConfigured:Boolean(process.env.ACS_VIDEO_GENERATOR_URL)});
 if(req.method==="POST"&&req.url==="/api/projects"){const input=await readBody(req),result=await executeGoldenPath(input),db=await load();db[result.project.id]=result;await save(db);return json(res,201,result);}
 const match=req.url?.match(/^\/api\/projects\/([^/]+)$/);
 if(req.method==="GET"&&match){const db=await load(),result=db[match[1]];return result?json(res,200,result):json(res,404,{error:"project not found"});}
 return json(res,404,{error:"not found"});
}catch(error){return json(res,400,{error:error.message});}});
server.listen(port,()=>console.log("ACS V3 runtime listening on :"+port));
