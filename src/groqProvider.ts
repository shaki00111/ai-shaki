export interface GroqHistoryItem { role: string; parts: Array<{ text?: string }>; }
export interface GroqMessage { role: "system" | "user" | "assistant"; content: string; }
export function groqKeysFromEnv(env: Record<string, unknown>): string[] {
  const keys:string[]=[];
  for(let index=1;index<=100;index++){
    const value=env["GROQ_API_KEY_"+index];
    if(typeof value==="string"&&value.trim())keys.push(value.trim());
  }
  return keys.filter((key,index,all)=>all.indexOf(key)===index);
}
export function buildGroqMessages(systemPrompt:string,userPrompt:string,history:readonly GroqHistoryItem[]=[]):GroqMessage[]{
  const messages:GroqMessage[]=[];
  if(systemPrompt.trim())messages.push({role:"system",content:systemPrompt.slice(0,60000)});
  for(const item of history.slice(-16)){
    const content=item.parts.filter(part=>typeof part.text==="string"&&part.text.trim()).map(part=>part.text!.slice(0,12000)).join("\n").slice(0,16000);
    if(!content)continue;
    messages.push({role:item.role==="model"||item.role==="assistant"?"assistant":"user",content});
  }
  messages.push({role:"user",content:userPrompt.slice(0,60000)});return messages;
}
const PREFERRED_MODELS=["openai/gpt-oss-20b","llama-3.3-70b-versatile","openai/gpt-oss-120b","llama-3.1-8b-instant"];
async function fetchBody(fetchImpl:typeof fetch,url:string,init:RequestInit,timeoutMs:number):Promise<{response:Response;body:string}>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort("Groq request timeout"),Math.max(1000,timeoutMs));
  try{const response=await fetchImpl(url,{...init,signal:controller.signal});return {response,body:await response.text()};}finally{clearTimeout(timer);}
}
function parseJson(body:string):any{try{return body?JSON.parse(body):null;}catch{return null;}}
function safeError(payload:any,raw:string,status:number,key:string):string{
  return String(payload?.error?.message??payload?.message??raw??("HTTP "+status)).replaceAll(key,"[REDACTED]").replace(/\s+/g," ").slice(0,350)||("HTTP "+status);
}
export async function callGroqText(apiKeys:readonly string[],messages:readonly GroqMessage[],timeoutMs=25000,maxTokens=4096,fetchImpl:typeof fetch=fetch):Promise<string>{
  const keys=[...new Set(apiKeys.map(key=>key.trim()).filter(Boolean))];
  if(!keys.length)throw new Error("Groq is not configured: add GROQ_API_KEY_1, GROQ_API_KEY_2, etc.");
  const deadline=Date.now()+Math.max(1000,timeoutMs);let lastError="No Groq key succeeded";
  for(let keyIndex=0;keyIndex<keys.length;keyIndex++){
    const key=keys[keyIndex],remaining=()=>deadline-Date.now();if(remaining()<1000)break;
    let candidates=[...PREFERRED_MODELS];
    try{
      const catalogue=await fetchBody(fetchImpl,"https://api.groq.com/openai/v1/models",{headers:{Authorization:"Bearer "+key,Accept:"application/json"}},Math.min(4000,remaining()));
      if([401,403,429].includes(catalogue.response.status)){
        lastError="Groq key "+(keyIndex+1)+" model discovery failed (HTTP "+catalogue.response.status+"): "+safeError(parseJson(catalogue.body),catalogue.body,catalogue.response.status,key);continue;
      }
      if(catalogue.response.ok){
        const modelData: unknown = parseJson(catalogue.body)?.data;
        const modelIds = Array.isArray(modelData)
          ? modelData.filter((item): item is { id: string } => Boolean(item) && typeof item === "object" && typeof (item as { id?: unknown }).id === "string").map(item => item.id)
          : [];
        const available = new Set<string>(modelIds);
        const listed=PREFERRED_MODELS.filter(model=>available.has(model));
        const others=[...available].filter(model=>/^(?:openai\/gpt-oss|llama|qwen|deepseek|gemma)/i.test(model)&&!/whisper|tts|guard|embedding/i.test(model));
        candidates=[...new Set([...listed,...others])].slice(0,5);if(!candidates.length)candidates=[...PREFERRED_MODELS];
      }
    }catch{/* Try preferred models if discovery fails. */}
    for(const model of candidates){
      if(remaining()<1000)break;let result:{response:Response;body:string};
      try{
        result=await fetchBody(fetchImpl,"https://api.groq.com/openai/v1/chat/completions",{
          method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"},
          body:JSON.stringify({model,messages,max_tokens:Math.max(256,Math.min(maxTokens,16384)),stream:false})
        },Math.min(20000,remaining()));
      }catch(error){lastError="Groq network/timeout error on key "+(keyIndex+1)+": "+(error instanceof Error?error.message:"request failed");break;}
      const {response,body}=result,payload=parseJson(body);
      if(!response.ok){
        const detail=safeError(payload,body,response.status,key);lastError="Groq HTTP "+response.status+" on key "+(keyIndex+1)+": "+detail;
        if(response.status===400&&/model|not found|does not exist|unsupported/i.test(detail))continue;
        if([401,403,429].includes(response.status)||response.status>=500)break;
        if(response.status===400)continue;break;
      }
      const answer=payload?.choices?.[0]?.message?.content;
      const text=typeof answer==="string"?answer.trim():Array.isArray(answer)?answer.map((part:any)=>typeof part?.text==="string"?part.text:"").join("").trim():"";
      if(text)return text;lastError="Groq returned an empty response for model "+model;
    }
  }
  throw new Error(lastError);
}
