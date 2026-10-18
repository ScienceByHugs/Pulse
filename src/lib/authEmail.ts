import { createAuthEmailGate } from '@/domain/authEmail';

// Session-memory courtesy limit; Supabase/provider limits remain authoritative
// across relaunches and devices. Never retry an email request automatically.
export const authEmailGate = createAuthEmailGate();
