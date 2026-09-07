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
