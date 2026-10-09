-- Structure : session > cours > chapitre > question ; progression par question (carte FSRS)
-- et historique complet des tentatives.

CREATE TABLE study_session (
	id serial PRIMARY KEY,
	name text NOT NULL,
	active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course (
	id serial PRIMARY KEY,
	session_id integer REFERENCES study_session(id) ON DELETE SET NULL,
	code text NOT NULL,
	name text NOT NULL,
	archived boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (session_id, code)
);

CREATE TABLE chapter (
	id serial PRIMARY KEY,
	course_id integer NOT NULL REFERENCES course(id) ON DELETE CASCADE,
	name text NOT NULL,
	source text,
	position integer NOT NULL DEFAULT 0,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (course_id, name)
);

CREATE TABLE question (
	id serial PRIMARY KEY,
	chapter_id integer NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
	course_id integer NOT NULL REFERENCES course(id) ON DELETE CASCADE,
	ext_id text,
	type text NOT NULL,
	concept text NOT NULL DEFAULT '',
	prompt text NOT NULL,
	explanation text NOT NULL DEFAULT '',
	payload jsonb NOT NULL,
	slide integer,
	difficulty smallint,
	tags text[] NOT NULL DEFAULT '{}',
	dedup_key text NOT NULL,
	position integer NOT NULL DEFAULT 0,
	flagged boolean NOT NULL DEFAULT false,
	flag_note text,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (course_id, dedup_key)
);
CREATE UNIQUE INDEX question_ext_id ON question (course_id, ext_id) WHERE ext_id IS NOT NULL;
CREATE INDEX question_chapter ON question (chapter_id);

-- Une carte par question déjà vue.
CREATE TABLE card (
	question_id integer PRIMARY KEY REFERENCES question(id) ON DELETE CASCADE,
	fsrs jsonb NOT NULL,
	due timestamptz NOT NULL,
	stability double precision NOT NULL,
	last_ok boolean NOT NULL,
	misconception boolean NOT NULL DEFAULT false,
	right_count integer NOT NULL DEFAULT 0,
	wrong_count integer NOT NULL DEFAULT 0,
	last_reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_due ON card (due);

CREATE TABLE series (
	id serial PRIMARY KEY,
	mode text NOT NULL,
	params jsonb NOT NULL DEFAULT '{}',
	state jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	finished_at timestamptz,
	abandoned boolean NOT NULL DEFAULT false
);

CREATE TABLE attempt (
	id bigserial PRIMARY KEY,
	question_id integer NOT NULL REFERENCES question(id) ON DELETE CASCADE,
	series_id integer REFERENCES series(id) ON DELETE SET NULL,
	at timestamptz NOT NULL DEFAULT now(),
	first_try boolean NOT NULL,
	correct boolean NOT NULL,
	score real NOT NULL,
	confidence text,
	overridden boolean NOT NULL DEFAULT false,
	answer jsonb,
	duration_ms integer
);
CREATE INDEX attempt_question ON attempt (question_id);
CREATE INDEX attempt_at ON attempt (at);

CREATE TABLE setting (
	key text PRIMARY KEY,
	value jsonb NOT NULL
);

INSERT INTO study_session (name) VALUES ('Session 1');
