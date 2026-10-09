-- Phase 2 : couverture par diapo. Phase 3 : évaluations, prédictions et instantanés quotidiens.

ALTER TABLE chapter ADD COLUMN slide_count integer;

CREATE TABLE evaluation (
	id serial PRIMARY KEY,
	course_id integer NOT NULL REFERENCES course(id) ON DELETE CASCADE,
	name text NOT NULL,
	date date NOT NULL,
	weight real,
	-- Chapitres couverts ; vide = tout le cours.
	chapter_ids integer[] NOT NULL DEFAULT '{}',
	predicted_grade real,
	predicted_at timestamptz,
	actual_grade real,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evaluation_date ON evaluation (date);

-- Une ligne par jour et par cours : nombre de questions à chaque niveau de maîtrise.
CREATE TABLE daily_snapshot (
	day date NOT NULL,
	course_id integer NOT NULL REFERENCES course(id) ON DELETE CASCADE,
	counts jsonb NOT NULL,
	total integer NOT NULL,
	PRIMARY KEY (day, course_id)
);
