import type { Topic } from './rooms';

/** Present saved evidence, never the canonical compatibility index as a percent. */
export function topicEvidenceLabel(topic: Pick<Topic,'canonical'|'last_practiced_at'|'mastery_score'|'status'>): string {
  const c=topic.canonical;
  if(c){
    if(!c.supported)return 'Source unavailable';
    if(c.needsCheck)return 'Needs another check';
    const stage={not_checked:'Not checked',practicing:'Practicing',independent:'Independent recall',transfer:'Applied independently'}[c.stage];
    return c.reviewDue?`${stage} · Review due`:stage;
  }
  if(!topic.last_practiced_at)return 'Not practiced';
  return `${Math.round(Number(topic.mastery_score))}% saved practice score`;
}

export function practiceCoverage(practiced: number, total: number): number {
  return total>0?Math.round(Math.max(0,Math.min(total,practiced))/total*100):0;
}
