-- Tema fiecarui cont. Valorile implicite pastreaza aplicatia exact cum era:
-- "classic" nu suprascrie nimic, iar un accent gol inseamna accentul temei.
ALTER TABLE "Settings" ADD COLUMN "themePreset" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN "themeAccent" TEXT NOT NULL DEFAULT '';
