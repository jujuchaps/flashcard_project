-- « Ne plus me la poser » : la question reste enregistrée (avec son historique) mais ne revient plus dans les quiz.
ALTER TABLE question ADD COLUMN ignored boolean NOT NULL DEFAULT false;
