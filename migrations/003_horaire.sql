-- Informations officielles des cours et horaire hebdomadaire.

ALTER TABLE course ADD COLUMN number text;
ALTER TABLE course ADD COLUMN teacher text;
ALTER TABLE course ADD COLUMN position integer NOT NULL DEFAULT 0;

CREATE TABLE course_slot (
	id serial PRIMARY KEY,
	course_id integer NOT NULL REFERENCES course(id) ON DELETE CASCADE,
	-- 1 = lundi … 7 = dimanche
	weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
	starts time NOT NULL,
	ends time NOT NULL,
	room text,
	-- T = théorie, L = laboratoire
	kind text
);
CREATE INDEX course_slot_course ON course_slot (course_id);

-- Migrations de données (réorganisation, données de départ), exécutées une seule fois.
CREATE TABLE data_migration (
	name text PRIMARY KEY,
	applied_at timestamptz NOT NULL DEFAULT now()
);
