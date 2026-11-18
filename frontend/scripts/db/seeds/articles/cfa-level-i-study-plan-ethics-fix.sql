-- Fixes the "Studying Ethics first" bullet in the live "CFA Level I study plan" row (2027 weights: no single topic leads).
-- Safe to run more than once: rows without the old wording are left alone.
WITH fixed AS (
  UPDATE articles SET
    draft = replace(draft::text, $old$- **Studying Ethics first.** It is the heaviest topic, and by exam day the details are gone. Study it late and review it twice.$old$,
                                 $new$- **Studying Ethics first.** The Standards fade fast, so study them late and review them twice.$new$)::jsonb,
    published = replace(published::text, $old$- **Studying Ethics first.** It is the heaviest topic, and by exam day the details are gone. Study it late and review it twice.$old$,
                                         $new$- **Studying Ethics first.** The Standards fade fast, so study them late and review them twice.$new$)::jsonb,
    date_modified = now(),
    version = version + 1,
    updated_at = now()
  WHERE slug = 'cfa-level-i-study-plan' AND published::text LIKE '%It is the heaviest topic, and by exam day%'
  RETURNING id, published
)
INSERT INTO article_revisions (article_id, kind, document, created_by)
SELECT fixed.id, 'publish', fixed.published, (SELECT id FROM admin_users WHERE role = 'owner' ORDER BY created_at LIMIT 1)
FROM fixed
RETURNING article_id;
