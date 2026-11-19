export interface GroqHistoryItem { role: string; parts: Array<{ text?: string }>; }
export interface GroqMessage { role: "system" | "user" | "assistant"; content: string; }
export function groqKeysFromEnv(env: Record<string, unknown>): string[] {
  return Object.entries(env).map(([name,value]) => {
    const match=/^GROQ_API_KEY_(\d+)$/.exec(name);
    return match && typeof value==="string" && value.trim() ? {index:Number(match[1]),key:value.trim()} : null;
  }).filter((item):item is {index:number;key:string} => item!==null && Number.isSafeInteger(item.index) && item.index>0)
    .sort((a,b)=>a.index-b.index).map(item=>item.key).filter((key,index,all)=>all.indexOf(key)===index).slice(0,100);
}
export function buildGroqMessages(systemPrompt:string,userPrompt:string,history:readonly GroqHistoryItem[]=[]):GroqMessage[] {
  const messages:GroqMessage[]=[];
  if(systemPrompt.trim()) messages.push({role:"system",content:systemPrompt.slice(0,60000)});
  for(const item of history.slice(-16)){
    const content=item.parts.filter(part=>typeof part.text==="string"&&part.text.trim()).map(part=>part.text!.slice(0,12000)).join("\n").slice(0,16000);
    if(!content) continue;
    messages.push({role:item.role==="model"||item.role==="assistant"?"assistant":"user",content});
  }
  messages.push({role:"user",content:userPrompt.slice(0,60000)});
  return messages;
}
const PREFERRED_MODELS=["openai/gpt-oss-20b","llama-3.3-70b-versatile","openai/gpt-oss-120b","llama-3.1-8b-instant"];
async function request(fetchImpl:typeof fetch,url:string,init:RequestInit,timeoutMs:number):Promise<Response>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort("Groq request timeout"),Math.max(1000,timeoutMs));
  try{return await fetchImpl(url,{...init,signal:controller.signal});}finally{clearTimeout(timer);}
}
function errorText(payload:any,raw:string,status:number):string{
  return String(payload?.error?.message??payload?.message??raw??("HTTP "+status)).replace(/\s+/g," ").slice(0,450)||("HTTP "+status);
}
export async function callGroqText(apiKeys:readonly string[],messages:readonly GroqMessage[],timeoutMs=25000,maxTokens=4096,fetchImpl:typeof fetch=fetch):Promise<string>{
  const keys=[...new Set(apiKeys.map(key=>key.trim()).filter(Boolean))];
  if(!keys.length) throw new Error("Groq is not configured: add GROQ_API_KEY_1, GROQ_API_KEY_2, etc.");
  const deadline=Date.now()+Math.max(1000,timeoutMs);let lastError="No Groq key succeeded";
  for(let keyIndex=0;keyIndex<keys.length;keyIndex++){
    const key=keys[keyIndex],remaining=()=>deadline-Date.now();if(remaining()<1000)break;
    let candidates=[...PREFERRED_MODELS];
    try{
      const catalogueResponse=await request(fetchImpl,"https://api.groq.com/openai/v1/models",{headers:{Authorization:"Bearer "+key,Accept:"application/json"}},Math.min(4000,remaining()));
      if([401,403,429].includes(catalogueResponse.status)){
        const raw=await catalogueResponse.text().catch(()=>"");
        lastError="Groq key "+(keyIndex+1)+" rejected during model discovery (HTTP "+catalogueResponse.status+"): "+raw.slice(0,180);continue;
      }
      if(catalogueResponse.ok){
        const catalogue=await catalogueResponse.json().catch(()=>null) as {data?:Array<{id?:string}>}|null;
        const available=new Set((catalogue?.data??[]).map(item=>item.id).filter((id):id is string=>typeof id==="string"));
        const listed=PREFERRED_MODELS.filter(model=>available.has(model));
        const others=[...available].filter(model=>/^(?:openai\/gpt-oss|llama|qwen|deepseek|gemma)/i.test(model)&&!/whisper|tts|guard|embedding/i.test(model));
        candidates=[...new Set([...listed,...others])].slice(0,5);if(!candidates.length)candidates=[...PREFERRED_MODELS];
      }
    }catch{/* try a preferred model if catalogue discovery fails */}
    for(const model of candidates){
      if(remaining()<1000)break;let response:Response;
      try{
        response=await request(fetchImpl,"https://api.groq.com/openai/v1/chat/completions",{
          method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"},
          body:JSON.stringify({model,messages,max_tokens:Math.max(256,Math.min(maxTokens,16384)),stream:false})
        },Math.min(20000,remaining()));
      }catch(error){lastError="Groq network/timeout error on key "+(keyIndex+1)+": "+(error instanceof Error?error.message:"request failed");break;}
      const raw=await response.text().catch(()=>"");let payload:any=null;try{payload=raw?JSON.parse(raw):null;}catch{}
      if(!response.ok){
        const detail=errorText(payload,raw,response.status);lastError="Groq HTTP "+response.status+" on key "+(keyIndex+1)+": "+detail;
        if(response.status===400&&/model|not found|does not exist|unsupported/i.test(detail))continue;
        if([401,403,429].includes(response.status)||response.status>=500)break;
        if(response.status===400)continue;break;
      }
      const answer=payload?.choices?.[0]?.message?.content;
      const text=typeof answer==="string"?answer.trim():Array.isArray(answer)?answer.map((part:any)=>typeof part?.text==="string"?part.text:"").join("").trim():"";
      if(text)return text;lastError="Groq returned an empty response for model "+model;break;
    }
  }
  throw new Error(lastError);
}
