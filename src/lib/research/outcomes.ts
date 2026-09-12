export type OutcomeCounts={reviewedSignals:number;conversations:number;proposals:number;instructions:number};
export function conversationRate(counts:OutcomeCounts):number|null{return counts.reviewedSignals===0?null:counts.conversations/counts.reviewedSignals;}
