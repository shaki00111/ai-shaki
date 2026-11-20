import test from "node:test";
import assert from "node:assert/strict";
import {buildGroqMessages,callGroqText,groqKeysFromEnv} from "../src/groqProvider.ts";
test("discovers numbered Groq secrets in numeric order and ignores invalid names",()=>{
 assert.deepEqual(groqKeysFromEnv({GROQ_API_KEY_3:" third ",GROQ_API_KEY_1:"first",GROQ_API_KEY_2:"",GROQ_API_KEY_10:"tenth",GROQ_API_KEY_BAD:"ignored",GROQ_API_KEY_0:"zero"}),["first","third","tenth"]);
});
test("preserves system prompt, recent history and Persian text",()=>{
 const messages=buildGroqMessages("system","سلام",[{role:"user",parts:[{text:"قبلی"}]},{role:"model",parts:[{text:"پاسخ"}]}]);
 assert.deepEqual(messages.map(item=>item.role),["system","user","assistant","user"]);assert.equal(messages.at(-1)?.content,"سلام");
});
test("rotates to the next key after a rate-limit response",async()=>{
 const seen=[];
 const fakeFetch=async(input,init)=>{
  const url=String(input),auth=new Headers(init?.headers).get("Authorization")??"";seen.push(auth);
  if(url.endsWith("/models"))return new Response(JSON.stringify({data:[{id:"openai/gpt-oss-20b"}]}),{status:200});
  if(auth==="Bearer first")return new Response(JSON.stringify({error:{message:"rate limit"}}),{status:429});
  return new Response(JSON.stringify({choices:[{message:{content:"سلام از Groq"}}]}),{status:200});
 };
 assert.equal(await callGroqText(["first","second"],[{role:"user",content:"سلام"}],5000,512,fakeFetch),"سلام از Groq");
 assert.ok(seen.includes("Bearer first")&&seen.includes("Bearer second"));
});
test("tries another model if the first model is unsupported",async()=>{
 const fakeFetch=async(input,init)=>{
  if(String(input).endsWith("/models"))return new Response(JSON.stringify({data:[{id:"openai/gpt-oss-20b"},{id:"llama-3.3-70b-versatile"}]}),{status:200});
  const body=JSON.parse(String(init?.body));
  if(body.model==="openai/gpt-oss-20b")return new Response(JSON.stringify({error:{message:"model not found"}}),{status:400});
  return new Response(JSON.stringify({choices:[{message:{content:"model two"}}]}),{status:200});
 };
 assert.equal(await callGroqText(["one"],[{role:"user",content:"hi"}],5000,512,fakeFetch),"model two");
});
test("redacts an API key from provider error details",async()=>{
 const fakeFetch=async()=>new Response(JSON.stringify({error:{message:"invalid secret-token"}}),{status:401});
 await assert.rejects(()=>callGroqText(["secret-token"],[{role:"user",content:"hi"}],5000,512,fakeFetch),error=>!String(error).includes("secret-token"));
});
test("rejects an empty key pool",async()=>{await assert.rejects(()=>callGroqText([],[{role:"user",content:"hi"}]),/GROQ_API_KEY_1/);});
