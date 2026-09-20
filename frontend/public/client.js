const API_ROOT = window.__ACS_CONFIG__?.apiRoot;
if (!API_ROOT) throw new Error("REACT_APP_BACKEND_URL is required");
const tokenKey = "acs_session_token";

export const session = {
  get token() { return localStorage.getItem(tokenKey); },
  set token(value) { value ? localStorage.setItem(tokenKey,value) : localStorage.removeItem(tokenKey); }
};

export async function api(path, options = {}) {
  const headers = {"content-type":"application/json",...(options.headers||{})};
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  const response = await fetch(`${API_ROOT}${path}`, {...options,headers});
  const payload = await response.json().catch(()=>({error:"Unexpected server response."}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function fileToDataUrl(file) {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = ()=>reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}