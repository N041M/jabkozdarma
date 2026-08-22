-- Optional starter pins for a fresh database (the same five Prague trees the
-- app shows in local mode). Run AFTER at least one user has signed in — the
-- pins get attributed to the oldest profile in the database.

insert into trees (location, variety, description, access, status, season_start, season_end, created_by)
select v.loc::geography, v.variety, v.descr, v.acc::access_type, v.st::tree_status, v.s1::smallint, v.s2::smallint, me.id
from (
  values
    ('SRID=4326;POINT(14.3922 50.0755)', 'Panenské české',
     'Zbytek starého sadu na svahu Petřína, dva stromy vedle sebe. Malá sladká jablka.',
     'public', 'active', 9, 10),
    ('SRID=4326;POINT(14.4442 50.0405)', null,
     'Řada jabloní podél cyklostezky pod Vyšehradem. Volně k trhání.',
     'roadside', 'active', 8, 9),
    ('SRID=4326;POINT(14.3862 50.1173)', 'Strýmka',
     'Velký solitér ve Stromovce u planetária. Kyselejší, skvělá do koláčů.',
     'public', 'active', 10, 11),
    ('SRID=4326;POINT(14.5081 50.0663)', null,
     'Strom ze zahrady přesahuje přes plot; majitel rád nechá kolemjdoucí otrhat, co přečnívá. Na víc zazvoňte.',
     'ask_owner', 'active', 9, 10),
    ('SRID=4326;POINT(14.4531 50.1029)', 'James Grieve',
     'Tři mladé stromy v komunitním sadu za holešovickou tržnicí.',
     'public', 'unverified', 8, 9)
) as v(loc, variety, descr, acc, st, s1, s2)
cross join (select id from profiles order by created_at limit 1) as me;

-- A couple of ripeness reports so pins aren't all "no report".
insert into reports (tree_id, user_id, state, note)
select t.id, t.created_by, 'ripe'::ripeness_state,
       'Spodní větve otrhané, ale výš je toho spousta.'
from trees t
where t.description like 'Řada jabloní%';

insert into reports (tree_id, user_id, state, note)
select t.id, t.created_by, 'unripe'::ripeness_state, 'Ještě tak dva týdny.'
from trees t
where t.variety = 'Panenské české';
