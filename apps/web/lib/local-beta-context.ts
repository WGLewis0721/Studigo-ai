import { cookies, headers } from 'next/headers';
import { localBetaAllowed } from './local-beta-access';
import { betaStore } from './local-beta';

export function localSessionId(value:string|undefined):string|null {
  return value&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)?value:null;
}
/** No production credentials, real account, bearer session, or user content enters this adapter. */
export async function serverLocalSession() {
  if(process.env.NODE_ENV!=='development'||process.env.STUDIGO_LOCAL_BETA!=='1')return null;
  const h=await headers();if(h.has('authorization'))return null;
  const host=h.get('host');if(!host)return null;
  let request:Request;try{request=new Request('http://'+host+'/',{headers:h});}catch{return null;}
  if(!localBetaAllowed(request))return null;
  const id=localSessionId((await cookies()).get('studigo_beta')?.value);if(!id)return null;
  return {id,store:betaStore(),state:betaStore().read(id)};
}
