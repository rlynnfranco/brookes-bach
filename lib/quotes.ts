import { supabase } from "@/lib/supabase";

export type Quote = {
  id: string;
  participant_id: string;
  quote: string;
  said_by: string | null;
  include_in_book: boolean;
  created_at: string;
};

export type QuoteWithLikes = Quote & {
  likeCount: number;
  likedByMe: boolean;
};

export async function getQuotesWithLikes(participantId: string) {
  const { data: quotes, error: quotesError } = await supabase
    .from("quotes")
    .select("id, participant_id, quote, said_by, include_in_book, created_at")
    .order("created_at", { ascending: false });

  if (quotesError) {
    throw quotesError;
  }

  const quoteRows = (quotes ?? []) as Quote[];

  if (quoteRows.length === 0) {
    return [] as QuoteWithLikes[];
  }

  const { data: likes, error: likesError } = await supabase
    .from("quote_likes")
    .select("quote_id, participant_id");

  if (likesError) {
    throw likesError;
  }

  const likeCountByQuote = new Map<string, number>();
  const likedByMe = new Set<string>();

  for (const like of likes ?? []) {
    const quoteId = like.quote_id as string;
    likeCountByQuote.set(quoteId, (likeCountByQuote.get(quoteId) ?? 0) + 1);

    if (like.participant_id === participantId) {
      likedByMe.add(quoteId);
    }
  }

  return quoteRows.map((quote) => ({
    ...quote,
    likeCount: likeCountByQuote.get(quote.id) ?? 0,
    likedByMe: likedByMe.has(quote.id),
  }));
}

export async function createQuote(
  participantId: string,
  quote: string,
  saidBy: string,
) {
  const trimmedQuote = quote.trim();
  const trimmedSaidBy = saidBy.trim();

  if (!trimmedQuote) {
    throw new Error("Write what was said.");
  }

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      participant_id: participantId,
      quote: trimmedQuote,
      said_by: trimmedSaidBy.length > 0 ? trimmedSaidBy : null,
    })
    .select("id, participant_id, quote, said_by, include_in_book, created_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...(data as Quote),
    likeCount: 0,
    likedByMe: false,
  } satisfies QuoteWithLikes;
}

export async function addQuoteLike(quoteId: string, participantId: string) {
  const { error } = await supabase.from("quote_likes").insert({
    quote_id: quoteId,
    participant_id: participantId,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export function quoteFromRealtimeRow(value: unknown): Quote | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (typeof row.id !== "string" || typeof row.quote !== "string") {
    return null;
  }

  return {
    id: row.id,
    participant_id:
      typeof row.participant_id === "string" ? row.participant_id : "",
    quote: row.quote,
    said_by: typeof row.said_by === "string" ? row.said_by : null,
    include_in_book: Boolean(row.include_in_book),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function quoteWithEmptyLikes(quote: Quote): QuoteWithLikes {
  return {
    ...quote,
    likeCount: 0,
    likedByMe: false,
  };
}

export function insertQuoteNewestFirst(
  quotes: QuoteWithLikes[],
  nextQuote: QuoteWithLikes,
) {
  if (quotes.some((quote) => quote.id === nextQuote.id)) {
    return quotes;
  }

  const nextTime = Date.parse(nextQuote.created_at) || 0;
  const insertAt = quotes.findIndex(
    (quote) => (Date.parse(quote.created_at) || 0) < nextTime,
  );

  if (insertAt === -1) {
    return [...quotes, nextQuote];
  }

  return [...quotes.slice(0, insertAt), nextQuote, ...quotes.slice(insertAt)];
}

export function quoteLikeFromRealtimeRow(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (typeof row.quote_id !== "string" || typeof row.participant_id !== "string") {
    return null;
  }

  return {
    quoteId: row.quote_id,
    participantId: row.participant_id,
  };
}

export function applyQuoteLikeEvent(
  quotes: QuoteWithLikes[],
  like: { quoteId: string; participantId: string },
  myParticipantId: string,
  change: "insert" | "delete",
) {
  return quotes.map((quote) => {
    if (quote.id !== like.quoteId) {
      return quote;
    }

    const isMine = like.participantId === myParticipantId;

    if (change === "insert") {
      if (isMine && quote.likedByMe) {
        return quote;
      }

      return {
        ...quote,
        likedByMe: isMine ? true : quote.likedByMe,
        likeCount: quote.likeCount + 1,
      };
    }

    if (isMine && !quote.likedByMe) {
      return quote;
    }

    return {
      ...quote,
      likedByMe: isMine ? false : quote.likedByMe,
      likeCount: Math.max(0, quote.likeCount - 1),
    };
  });
}

export async function removeQuoteLike(quoteId: string, participantId: string) {
  const { error } = await supabase
    .from("quote_likes")
    .delete()
    .eq("quote_id", quoteId)
    .eq("participant_id", participantId);

  if (error) {
    throw error;
  }
}
