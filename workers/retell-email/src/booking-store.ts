import { neon } from '@neondatabase/serverless';
import { neonSql } from './store.ts';
import type { BookingOffer, BookingRecord, BookingState, BookingSummary, BookingTransaction, BookingQuery, BookingType } from './booking-types.ts';
export class BookingStore {
  private query: BookingQuery;
  private transaction: BookingTransaction;
  constructor(query: BookingQuery,transaction: BookingTransaction) { this.query=query; this.transaction=transaction; }
  static connect(url: string) {
    const query=neonSql(url),client=neon(url);
    return new BookingStore(query,async statements=>await client.transaction(statements.map(s=>client.query(s.text,s.params||[])),{fetchOptions:{signal:AbortSignal.timeout(5000)}}) as Record<string,unknown>[][]);
  }
  async offer(offer: BookingOffer) {
    await this.query(`INSERT INTO orvanta_workflow.booking_offers(id,call_id,agent_id,workspace_id,booking_type,calendar_id,time_zone,starts_at,ends_at,expires_at)
      VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::timestamptz)`,
      [offer.id,offer.call_id,offer.agent_id,offer.workspace_id,offer.booking_type,offer.calendar_id,offer.time_zone,offer.starts_at,offer.ends_at,offer.expires_at]);
  }
  async getOffer(id: string, callId: string, agentId: string, workspace: string): Promise<BookingOffer|null> {
    const [row]=await this.query(`SELECT * FROM orvanta_workflow.booking_offers WHERE id=$1::uuid AND call_id=$2 AND agent_id=$3 AND workspace_id=$4`,[id,callId,agentId,workspace]);
    return row as unknown as BookingOffer || null;
  }
  async existing(callId: string,type: BookingType,workspace: string): Promise<BookingRecord|null> {
    const [row]=await this.query(`SELECT *,id AS booking_id FROM orvanta_workflow.bookings WHERE call_id=$1 AND booking_type=$2 AND workspace_id=$3
      AND status IN ('creating','confirmed','review') ORDER BY created_at DESC LIMIT 1`,[callId,type,workspace]);
    return row as unknown as BookingRecord || null;
  }
  async byOffer(offerId: string): Promise<BookingRecord|null> {
    const [row]=await this.query('SELECT *,id AS booking_id FROM orvanta_workflow.bookings WHERE offer_id=$1::uuid',[offerId]);
    return row as unknown as BookingRecord || null;
  }
  async claim(offer: BookingOffer,name: string,phone: string): Promise<{record:BookingRecord|null;owned:boolean}> {
    const previous=await this.byOffer(offer.id) || await this.existing(offer.call_id,offer.booking_type,offer.workspace_id);
    if(previous)return {record:previous,owned:false};
    const id=crypto.randomUUID();
    try {
      const [rows]=await this.transaction([
        {text:`INSERT INTO orvanta_workflow.bookings(id,offer_id,call_id,agent_id,workspace_id,booking_type,calendar_id,time_zone,starts_at,ends_at,customer_name,callback_number)
          VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11,$12)
          ON CONFLICT(offer_id) DO NOTHING RETURNING *,id AS booking_id`,
          params:[id,offer.id,offer.call_id,offer.agent_id,offer.workspace_id,offer.booking_type,offer.calendar_id,offer.time_zone,offer.starts_at,offer.ends_at,name,phone]},
        {text:`INSERT INTO orvanta_workflow.booking_slot_claims(calendar_id,starts_at,booking_id)
          SELECT b.calendar_id,s.minute,b.id FROM orvanta_workflow.bookings b,
          LATERAL generate_series(b.starts_at,b.ends_at-interval '1 minute',interval '1 minute') s(minute)
          WHERE b.id=$1::uuid`,params:[id]},
      ]);
      const record=rows[0] as unknown as BookingRecord;
      return record?{record,owned:true}:{record:await this.byOffer(offer.id),owned:false};
    } catch(error) {
      if((error as {code?:string}).code!=='23505')throw new Error('booking_claim_unavailable',{cause:error});
      return {record:await this.byOffer(offer.id)||await this.existing(offer.call_id,offer.booking_type,offer.workspace_id),owned:false};
    }
  }
  async finish(id: string,status: BookingState,providerId: string|null,error: string|null) {
    await this.transaction([
      {text:`UPDATE orvanta_workflow.bookings SET status=$2,provider_event_id=$3,last_error=$4,updated_at=now()
        WHERE id=$1::uuid AND status IN ('creating','review')`,params:[id,status,providerId,error]},
      {text:`DELETE FROM orvanta_workflow.booking_slot_claims s USING orvanta_workflow.bookings b WHERE s.booking_id=b.id AND b.id=$1::uuid AND b.status IN ('failed','unavailable')`,params:[id]},
    ]);
  }
  async reserved(start: string,end: string,calendar: string) {
    return await this.query(`SELECT starts_at AS start,ends_at AS end FROM orvanta_workflow.bookings WHERE calendar_id=$1 AND status IN ('creating','confirmed','review') AND starts_at<$3::timestamptz AND ends_at>$2::timestamptz`,[calendar,start,end]) as unknown as {start:string;end:string}[];
  }
  async decline(callId: string,agentId: string,workspace: string,type: BookingType,calendar: string,zone: string) {
    const existing=await this.existing(callId,type,workspace);
    if(existing)return this.summary(existing);
    await this.query(`UPDATE orvanta_workflow.booking_offers SET status='declined' WHERE call_id=$1 AND workspace_id=$2 AND booking_type=$3 AND status='offered'`,[callId,workspace,type]);
    await this.recordOutcome(callId,agentId,workspace,type,calendar,zone,'declined');
    return {type,status:'declined',timeZone:zone,start:null,end:null,providerBookingId:null} as BookingSummary;
  }
  async recordOutcome(callId: string,agentId: string,workspace: string,type: BookingType,calendar: string,zone: string,status:'declined'|'unavailable'|'failed') {
    await this.query(`INSERT INTO orvanta_workflow.booking_offers(id,call_id,agent_id,workspace_id,booking_type,calendar_id,time_zone,expires_at,status)
      VALUES($1::uuid,$2,$3,$4,$5,$6,$7,now(),$8)`,[crypto.randomUUID(),callId,agentId,workspace,type,calendar,zone,status]);
  }
  async unavailableOffer(id: string) { await this.query("UPDATE orvanta_workflow.booking_offers SET status='unavailable' WHERE id=$1::uuid AND status='offered'",[id]); }
  async markInterrupted() { await this.query("UPDATE orvanta_workflow.bookings SET status='review',last_error='interrupted_creation',updated_at=now() WHERE status='creating' AND created_at<now()-interval '2 minutes'"); }
  summary(row: BookingRecord): BookingSummary {
    return {type:row.booking_type,status:row.status,timeZone:row.time_zone,start:row.starts_at,end:row.ends_at,providerBookingId:row.status==='confirmed'?row.provider_event_id:null};
  }
  async summaries(callId: string,workspace: string): Promise<BookingSummary[]> {
    const rows=await this.query(`SELECT DISTINCT ON (o.booking_type) o.booking_type,o.time_zone,o.starts_at,o.ends_at,
      coalesce(b.status,o.status) AS status,b.provider_event_id FROM orvanta_workflow.booking_offers o
      LEFT JOIN orvanta_workflow.bookings b ON b.offer_id=o.id WHERE o.call_id=$1 AND o.workspace_id=$2
      ORDER BY o.booking_type,CASE WHEN b.status IN ('confirmed','creating','review') THEN 0 ELSE 1 END,coalesce(b.updated_at,o.created_at) DESC`,[callId,workspace]);
    return (['callback','cleaning_visit'] as BookingType[]).map(type=>{
      const row=rows.find(r=>r.booking_type===type);
      return row?{type,status:row.status as BookingState,timeZone:row.time_zone as string,start:row.starts_at as string|null,end:row.ends_at as string|null,providerBookingId:row.status==='confirmed'?row.provider_event_id as string:null}:
        {type,status:'not_requested',timeZone:null,start:null,end:null,providerBookingId:null};
    });
  }
}
