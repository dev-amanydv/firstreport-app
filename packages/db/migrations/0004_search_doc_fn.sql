-- The text Explore search matches: headline (weight A), card text, and entities (weight B).
-- Declared IMMUTABLE so events.search_doc can be a stored generated column; array_to_string is only
-- STABLE in general, but on text[] its output never changes.
CREATE FUNCTION events_search_doc(headline text, neutral text, entities text[]) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english'::regconfig, coalesce(headline, '')), 'A')
      || setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(entities, ' '), '')), 'B')
      || to_tsvector('english'::regconfig, coalesce(neutral, ''))
$$;
